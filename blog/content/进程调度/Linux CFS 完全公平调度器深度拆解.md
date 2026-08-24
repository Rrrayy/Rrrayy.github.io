# Linux CFS 完全公平调度器（Completely Fair Scheduler）深度拆解

> **作者**：c弟 | **分类**：操作系统 | **标签**：Linux、调度器、CFS、内核
>
> ⏱ **阅读时间**：约 25 分钟 | 🎯 **前置知识**：了解进程和线程基本概念即可
>
> 本文从零开始拆解 Linux CFS 调度器，覆盖 vruntime、红黑树、调度延迟、完整调度流程、上下文切换开销，以及 IO 密集型 vs CPU 密集型调度分析。适合配合 OSTEP 或小林 coding 一起看，作为深入理解调度器的补充材料。

---

## 目录

- [一、调度器要解决的根本问题](#一调度器要解决的根本问题)
- [二、vruntime —— 最核心的概念](#二vruntime--最核心的概念)
- [三、权重与 nice 值映射](#三权重与-nice-值映射)
  - [3.4 阻塞进程的 vruntime 补偿](#34-阻塞进程的-vruntime-补偿)
- [四、红黑树 —— 为什么必须是它](#四红黑树--为什么必须是它)
- [五、调度延迟与最小粒度](#五调度延迟与最小粒度)
- [六、完整调度流程 —— 逐函数拆解](#六完整调度流程--逐函数拆解)
  - [6.8 sched_yield() —— 自愿让出 CPU](#68-sched_yield--自愿让出-cpu)
- [七、上下文切换的三件开销](#七上下文切换的三件开销)
- [八、IO 密集型 vs CPU 密集型 —— 时间线分析](#八io-密集型-vs-cpu-密集型--时间线分析)
- [九、总结：CFS 为什么优雅](#九总结cfs-为什么优雅)

---

## 一、调度器要解决的根本问题

在讲 CFS 之前，先理解**所有调度器都在解决同一个核心矛盾**：

```
有限的 CPU 资源 vs 无限的进程需求
```

假设只有一个 CPU，但有 N 个进程要跑。调度器需要决定：**谁先跑？跑多久？换谁？**

### 三个评价指标

| 指标 | 含义 | 反问自己 |
|:----|:----|:--------|
| **公平（Fairness）** | 每个进程是否获得了应得的 CPU 份额 | 有没有进程被饿死？ |
| **效率（Efficiency）** | 上下文切换开销占比是否合理 | 切换太频繁会不会浪费 CPU？ |
| **响应（Responsiveness）** | 交互式进程是否能快速得到 CPU | 敲键盘会不会卡？ |

### CFS 的思路

**传统调度器（MLFQ）** 维护多个优先级队列，高优先级先跑，时间片用完降级。问题在于优先级怎么调？调不好交互式进程就卡了。

**CFS 完全不同**：它不搞"优先级队列"，而是用 **"虚拟时间"** 衡量每个进程的 CPU 消费量。谁消费得少，谁就上 CPU —— 一句话，CFS 用数学代替了策略。

---

## 二、vruntime —— 最核心的概念

### 2.1 定义

**vruntime（virtual runtime，虚拟运行时间）**：每个进程已经消耗的"加权 CPU 时间"，单位是纳秒。

### 2.2 核心公式

```
vruntime += Δt × (NICE_0_LOAD / weight)
```

- `Δt` = 进程本次实际运行的时间（纳秒）
- `NICE_0_LOAD` = 1024（nice=0 的标准权重，内核常量）
- `weight` = 该进程的权重（由 nice 值决定）

### 2.3 公式的直觉理解

把公式看成一条分数：

```
vruntime = 物理运行时间 × (1024 / 权重)
                          ↑
                      优先级系数
```

| 情况 | weight | 1024/weight | vruntime 变化 | 含义 |
|:----|:-----:|:----------:|:------------:|:----|
| nice=0（默认） | 1024 | 1 | vruntime = 实际时间 | 基准线 |
| nice=-5（高优） | 3121 | ~0.33 | 涨得慢 → CFS 多给它 CPU | 1ms 实际时间只涨 0.33ms |
| nice=5（低优） | 335 | ~3.06 | 涨得快 → CFS 少给它 CPU | 1ms 实际时间涨 3.06ms |



```
nice=0  进程跑 1ms → vruntime += 1ms × 1.0  = 1ms      （正常走）
nice=-5 进程跑 1ms → vruntime += 1ms × 0.33 = 0.33ms   （走得慢 → 调度器多给它跑）
nice=5  进程跑 1ms → vruntime += 1ms × 3.06 = 3.06ms   （走得快 → 调度器少给它跑）
```

**一句话**：高优先级的 vruntime 增长慢 → CFS 以为它"吃得少" → 多给它 CPU。

---

## 三、权重与 nice 值映射

### 3.1 权重表

Linux 内核定义了完整的 40 级权重映射数组（`kernel/sched/core.c`）：

```c
const int sched_prio_to_weight[40] = {
    /* -20 */ 88761, 71755, 56483, 46273, 36291,
    /* -15 */ 29154, 23254, 18705, 14949, 11916,
    /* -10 */ 9548,  7620,  6100,  4904,  3906,
    /* -5  */ 3121,  2501,  1991,  1586,  1277,
    /*  0  */ 1024,  820,   655,   526,   423,
    /*  5  */ 335,   272,   215,   172,   137,
    /* 10  */ 110,   87,    70,    56,    45,
    /* 15  */ 36,    29,    23,    18,    15,
};
```

### 3.2 规律

**nice 每差 1 级，权重相差约 25%。**

从 nice=0 往下推（优先级降低）：
```
nice=0   权重 1024
nice=1   权重 1024 ÷ 1.25 = 820
nice=2   权重 820  ÷ 1.25 = 655
nice=3   权重 655  ÷ 1.25 = 526
nice=4   权重 526  ÷ 1.25 = 423
nice=5   权重 423  ÷ 1.25 = 335
```

从 nice=0 往上推（优先级提升）：
```
nice=0   权重 1024
nice=-1  权重 1024 × 1.25 = 1277
nice=-2  权重 1277 × 1.25 = 1586
nice=-3  权重 1586 × 1.25 = 1991
nice=-4  权重 1991 × 1.25 = 2501
nice=-5  权重 2501 × 1.25 = 3121
```

**权重值具体怎么算？** 内核的规则是 **nice 每差 1 级，权重 ×1.25 或 ÷1.25**（这样设计是为了让 nice 差 1 ≈ CPU 份额差 10%）。

nice=0 的权重定为 1024（2^10，好算），然后：

```
nice=-5 的权重 = 1024 × 1.25^5 = 1024 × 3.052 = 3125 → 内核取整 3121
nice=5 的权重  = 1024 ÷ 1.25^5 = 1024 ÷ 3.052 = 335.5 → 取整 335
```

> 内核数组里的值（3121）跟理论值（3125）差了一点，因为内核用了一个比 1.25 更精确的衰减因子，在编译时预算成整数查表——调度热路径上不能有浮点运算。

### 3.3 CPU 分配比例

两个进程，nice=0（权重 1024）和 nice=1（权重 820）：

```
nice=0 得分 = 1024 / (1024 + 820) ≈ 55.5%
nice=1 得分 = 820  / (1024 + 820) ≈ 44.5%
```

相差约 **11%**，符合预期。

最极端——nice=0 与 nice=19：

```
nice=0  得分 = 1024 / (1024 + 15) = 98.6%
nice=19 得分 = 15  / (1024 + 15) = 1.4%
```

**即使最低优先级的进程也不被饿死**——CFS 的公平原则。

### 3.4 阻塞进程的 vruntime 补偿

**问题**：进程阻塞了 100ms，vruntime 还是 0。恢复就绪后 vruntime=0 远小于别人，会长时间插队——不公平。

**解决方案**：内核维护了一个 `cfs_rq->min_vruntime`，是当前就绪队列里最小的 vruntime。

```c
// 进程恢复就绪时
vruntime = max(原vruntime, cfs_rq->min_vruntime - 偏移量);
```

当 min_vruntime 已经涨到 80 时，恢复就绪进程的 vruntime 被拉到 80 附近——不会再插队。

**更精细的设计**：内核会从 min_vruntime 中**减去一个小偏移**（通常约一个时间片），让恢复就绪的进程略低于 min_vruntime。这是 CFS 的巧妙平衡——既不能让它无限插队，也不能让它恢复后被迫等太久。IO 密集型进程之所以响应快，正是靠这个微小的"阻塞补偿"。

---

## 四、红黑树 —— 为什么必须是它

### 4.1 红黑树的五个性质

1. 每个节点要么红色要么黑色
2. 根节点是黑色
3. 叶子节点（NIL）是黑色
4. 红色节点的子节点必须是黑色（不能连续红）
5. 从任意节点到叶子节点的路径上，黑色节点数量相同

性质 4+5 保证了最长路径不超过最短路径的 2 倍，所以最坏情况也是 O(log n)。

### 4.2 四种数据结构的全面对比

| 维度 | 数组 | 链表 | 二叉堆 | 红黑树 |
|:----|:---:|:----:|:------:|:------:|
| **找最小/取最左** | O(1) | O(1) | O(1) | **O(1)** |
| **插入一个进程** | O(n) | O(n) | O(log n) | **O(log n)** |
| **删除一个进程** | O(n) | O(1) | O(log n) | **O(log n)** |
| **找任意指定进程** | O(1)¹ | O(n) | O(n) | **O(log n)** |
| **最坏情况** | O(n) | O(n) | O(log n) | **O(log n)** |

> ¹ 数组的 O(1) 前提是已知下标；CFS 需要按 PID 定位进程而不是按数组下标，所以数组在该场景下实际也是 O(n)。

**红黑树胜出的核心原因**：二叉堆虽然找最小/插入/删除都是 O(log n)，但**查找任意指定元素需要 O(n) 遍历**。而 CFS 经常需要精确操作某进程（如信号唤醒、`sched_yield()` 主动让出 CPU、定时器到期），这些操作都要先找到它然后重新插入——二叉堆做不到 O(log n) 精确查找，红黑树可以。

**辅助记忆**：Jemalloc 的 extent tree 也用了红黑树——内核和用户态内存管理的高频操作场景，红黑树是经典选择。

### 4.3 内核优化：rb_root_cached

```c
struct cfs_rq {
    struct rb_root_cached tasks_timeline; // 红黑树根（缓存最左节点指针）
    u64 min_vruntime;
    // ...
};
```

`rb_root_cached` 在内核根节点里缓存了最左节点的指针，取最小元素是**真正的 O(1)** 而非 O(log n)。这就是那一丁点常数级的优化——高频路径上，每纳秒都算。

---

## 五、调度延迟与最小粒度

### 5.1 核心矛盾

```
上下文切换有开销（TLB 刷新 + 缓存污染 + 寄存器保存）
→ 切换越频繁，CPU 花在"换人"上的比例越高

不切换又不行，进程会饿死
→ 切换越少，响应越差
```

### 5.2 Targeted Latency（目标延迟）

CFS 保证所有就绪进程在 **目标延迟** 时间内至少各跑一次，默认 **20ms**。

| 就绪进程数 | 每个进程时间片 | 轮一圈时间 |
|:---------:|:------------:|:---------:|
| 2 | 20/2 = 10ms | 20ms |
| 4 | 20/4 = 5ms | 20ms |
| 10 | 20/10 = 2ms | 20ms |

```
每个进程的时间片 = targeted_latency / nr_running
```

### 5.3 Minimum Granularity（最小粒度）

进程太多时，每个时间片会变得极小，切换开销占比失控：

```
100 个就绪进程 → 每个 0.2ms
切换约 10μs → 10/200 = 5% CPU 花在切换上 → 不划算
```

**解决方案**：设一个最小时间片，默认 **1ms**。

```
① 先按 targeted_latency / nr_running 算
② 如果结果 < min_granularity（1ms）：
   → 每个进程固定 1ms
   → 轮一圈总时间 = nr_running × 1ms（超过了 20ms，牺牲延迟保效率）
```

**临界点**：20ms / 1ms = **20 个进程**

| 进程数 | 每个时间片 | 总周期 |
|:-----:|:---------:|:------:|
| ≤ 20 | 动态分配 | 20ms |
| > 20 | 固定 1ms | > 20ms |

为什么 1ms 合适？切换开销约 10μs / 1000μs = 1% 开销比——可接受。

### 5.4 完整公式

```c
time_slice = max(min_granularity, targeted_latency / nr_running);
```

---

## 六、完整调度流程 —— 逐函数拆解

### 宏观前提：推迟执行设计

```
硬件时钟每 ~4ms 发一次中断
         ↓
中断来了 → 不能在中断上下文里直接切换（可能持有自旋锁）
         ↓
只干两件事：①更新 vruntime ②决定要不要换
         ↓
如果要换 → 设 TIF_NEED_RESCHED 标志位（一个位操作，零开销）
         ↓
等到安全点（中断返回/系统调用返回）→ 才真正 schedule() 换人
```

这种设计叫**推迟执行（Deferred Scheduling）**，所有现代操作系统都用。为什么？中断处理程序可能持有自旋锁，如果在中断里直接调用 `schedule()`，而 `schedule()` 又可能睡眠——持锁阻塞就是死锁。

### 6.1 scheduler_tick() —— 时钟中断处理

**调用者**：硬件时钟中断（HPET/APIC timer）

实际的调用链由 4 个函数组成，从入口到核心递进。以下源码均在本地提取，提取过程如下：

```
rr@rr-VMware-Virtual-Platform:~$ sudo apt install -y linux-source
rr@rr-VMware-Virtual-Platform:~$ cd /usr/src && sudo tar -xf linux-source-6.8.0.tar.bz2
rr@rr-VMware-Virtual-Platform:~$ cd linux-source-6.8.0/kernel/sched
```

**① task_tick_fair —— 入口**

```
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ grep -n "static void task_tick_fair" fair.c
12680:static void task_tick_fair(struct rq *rq, struct task_struct *curr, int queued)
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ sed -n '12680,12693p' fair.c
static void task_tick_fair(struct rq *rq, struct task_struct *curr, int queued)
{
    struct cfs_rq *cfs_rq;
    struct sched_entity *se = &curr->se;

    for_each_sched_entity(se) {
        cfs_rq = cfs_rq_of(se);
        entity_tick(cfs_rq, se, queued);
    }

    if (static_branch_unlikely(&sched_numa_balancing))
        task_tick_numa(rq, curr);

    update_misfit_status(curr, rq);
    check_update_overutilized_status(task_rq(curr));
    task_tick_core(rq, curr);
}
```

**② entity_tick —— 逐实体处理**

```
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ grep -n "entity_tick" fair.c | head -3
5483:entity_tick(struct cfs_rq *cfs_rq, struct sched_entity *curr, int queued)
12687:        entity_tick(cfs_rq, se, queued);
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ sed -n '5483,5506p' fair.c
entity_tick(struct cfs_rq *cfs_rq, struct sched_entity *curr, int queued)
{
    /*
     * Update run-time statistics of the 'current'.
     */
    update_curr(cfs_rq);

    /*
     * Ensure that runnable average is periodically updated.
     */
    update_load_avg(cfs_rq, curr, UPDATE_TG);
    update_cfs_group(curr);

#ifdef CONFIG_SCHED_HRTICK
    if (queued) {
        resched_curr(rq_of(cfs_rq));
        return;
    }
    if (!sched_feat(DOUBLE_TICK) &&
            hrtimer_active(&rq_of(cfs_rq)->hrtick_timer))
        return;
#endif
}
```

**③ update_curr —— 核心：更新 vruntime** ⭐

```
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ grep -n "static void update_curr" fair.c
1151:static void update_curr(struct cfs_rq *cfs_rq)
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ sed -n '1151,1171p' fair.c
static void update_curr(struct cfs_rq *cfs_rq)
{
    struct sched_entity *curr = cfs_rq->curr;
    s64 delta_exec;

    if (unlikely(!curr))
        return;

    delta_exec = update_curr_se(rq_of(cfs_rq), curr);
    if (unlikely(delta_exec <= 0))
        return;

    curr->vruntime += calc_delta_fair(delta_exec, curr);
    update_deadline(cfs_rq, curr);

    if (entity_is_task(curr))
        update_curr_task(task_of(curr), delta_exec);

    account_cfs_rq_runtime(cfs_rq, delta_exec);
}
```

**④ calc_delta_fair —— 权重计算公式** ⭐

```
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ grep -n "calc_delta_fair" fair.c | head -3
296:static inline u64 calc_delta_fair(u64 delta, struct sched_entity *se)
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ sed -n '296,301p' fair.c
static inline u64 calc_delta_fair(u64 delta, struct sched_entity *se)
{
    if (unlikely(se->load.weight != NICE_0_LOAD))
        delta = __calc_delta(delta, NICE_0_LOAD, &se->load);

    return delta;
}
```

一行关键代码串联了整个调用链：

```c
curr->vruntime += calc_delta_fair(delta_exec, curr);
    // → 如果权重≠1024，则 __calc_delta(delta, 1024, &se->load)
    // → 等价于 vruntime += delta_exec × (1024 / weight)
```

**注意**：Δ_t 不是固定 4ms。时钟中断可能被其他中断延迟，所以 Δ_t 是本次 tick 距离上次 tick 的真实时间间隔，由 `update_curr_se()` 精确测量。

### 6.2 set_tsk_need_resched() —— 设标志位

```c
static inline void set_tsk_need_resched(struct task_struct *tsk) {
    set_tsk_thread_flag(tsk, TIF_NEED_RESCHED);
}
```

就一行——把进程 `flags` 字段的 `TIF_NEED_RESCHED` 位设为 1。一个位操作，极轻量。

**为什么设标志位而不是直接调 schedule()？**
- 中断上下文没有进程结构，无法切换
- 中断处理程序可能持有自旋锁
- 持锁状态下阻塞 = 死锁

### 6.3 检查标志位的地方（安全点）

只有三个地方会检查 `TIF_NEED_RESCHED`：

| 安全点 | 时机 | 说明 |
|:-----|:----|:----|
| **从内核态返回用户态** | 系统调用/中断处理完毕 | 最常用，无锁无中断上下文 |
| **从中断返回内核态** | 中断嵌套时外层中断返回 | 仅当不嵌套时可调度 |
| **进程主动让出 CPU** | sched_yield()/sleep() | 自愿切换，不依赖标志位 |

### 6.4 schedule() —— 真正的调度函数

```c
asmlinkage __visible void __sched schedule(void) {
    struct task_struct *prev, *next;
    struct rq *rq = cpu_rq(smp_processor_id());
    prev = rq->curr;

    preempt_disable();                     // ① 关抢占，避免重入

    next = pick_next_task(rq, prev);      // ② 从红黑树选下一个进程

    if (prev != next)
        context_switch(rq, prev, next);    // ③ 上下文切换

    preempt_enable();                      // ④ 开抢占
}
```

### 6.5 pick_next_task() —— 选进程

从红黑树取最左节点（vruntime 最小）：

```
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ grep -n "__pick_first_entity" fair.c | head -3
828:struct sched_entity *__pick_first_entity(struct cfs_rq *cfs_rq)
880:    struct sched_entity *se = __pick_first_entity(cfs_rq);
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ sed -n '828,838p' fair.c
struct sched_entity *__pick_first_entity(struct cfs_rq *cfs_rq)
{
    struct rb_node *left = rb_first_cached(&cfs_rq->tasks_timeline);

    if (!left)
        return NULL;

    return __node_2_se(left);
}
```

`rb_first_cached()` 取出红黑树最左节点——即 vruntime 最小的进程，O(1) 复杂度。再通过 `task_of(se)` 拿到外面的 `task_struct` 返回。

### 6.6 context_switch() —— 上下文切换

```c
static inline void
context_switch(struct rq *rq, struct task_struct *prev,
               struct task_struct *next) {
    // ① 切换虚拟地址空间（含 TLB 刷新）
    if (prev->mm != next->mm)
        switch_mm_irqs_off(prev->active_mm, next->mm, next);
        // 内部：加载 next 的页表基地址到 CR3 寄存器
        // 硬件检测到 CR3 变了 → 自动清空所有 TLB 条目

    // ② 切换寄存器和栈（汇编实现）
    switch_to(prev, next, prev);
}
```

**注意**：同一进程的多个线程（`prev->mm == next->mm`）切换时不需要换页表，这是线程切换比进程切换快的原因之一。

### 6.7 switch_to() —— 汇编级栈切换

这个函数必须用汇编写，因为 C 语言无法直接操作栈指针 `rsp`。以下是从 x86-64 架构源码提取的真实实现：

```
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/arch/x86/entry$ grep -n "__switch_to_asm" entry_64.S
177:SYM_FUNC_START(__switch_to_asm)
216:SYM_FUNC_END(__switch_to_asm)
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/arch/x86/entry$ sed -n '177,216p' entry_64.S
SYM_FUNC_START(__switch_to_asm)
    /*
     * Save callee-saved registers
     * This must match the order in inactive_task_frame
     */
    pushq    %rbp
    pushq    %rbx
    pushq    %r12
    pushq    %r13
    pushq    %r14
    pushq    %r15

    /* switch stack */
    movq    %rsp, TASK_threadsp(%rdi)    # rdi=prev, 保存当前栈指针到 prev->thread.sp
    movq    TASK_threadsp(%rsi), %rsp    # rsi=next, 加载 next 的栈指针到 rsp

    /* restore callee-saved registers */
    popq    %r15
    popq    %r14
    popq    %r13
    popq    %r12
    popq    %rbx
    popq    %rbp

    jmp    __switch_to                    # 跳到 C 函数 __switch_to() 继续处理
SYM_FUNC_END(__switch_to_asm)
```

**最关键的一步**：`movq TASK_threadsp(%rsi), %rsp` 执行完后，CPU 已经站在 next 的内核栈上了。后面的 `popq` 和 `jmp __switch_to` 都基于 next 的上下文执行——这就是"切换"的本质。

### 6.8 sched_yield() —— 自愿让出 CPU

`sched_yield()` 让当前进程主动放弃 CPU。先看它的内核实现：

```
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ grep -n "yield_task_fair" fair.c | head -3
8561:static void yield_task_fair(struct rq *rq)
8612:    yield_task_fair(rq);
rr@rr-VMware-Virtual-Platform:/usr/src/linux-source-6.8.0/kernel/sched$ sed -n '8561,8595p' fair.c
static void yield_task_fair(struct rq *rq)
{
    struct task_struct *curr = rq->curr;
    struct cfs_rq *cfs_rq = task_cfs_rq(curr);
    struct sched_entity *se = &curr->se;

    /*
     * Are we the only task in the tree?
     */
    if (unlikely(rq->nr_running == 1))
        return;

    clear_buddies(cfs_rq, se);

    update_rq_clock(rq);
    /*
     * Update run-time statistics of the 'current'.
     */
    update_curr(cfs_rq);
    /*
     * Tell update_rq_clock() that we've just updated,
     * so we don't do microscopic update in schedule()
     * and double the fastpath cost.
     */
    rq_clock_skip_update(rq);

    /*
     * Forfeit the remaining vruntime, only if the entity is eligible.
     */
    if (entity_eligible(cfs_rq, se))
        se->vruntime = cfs_rq->min_vruntime;    // ← 关键：vruntime 拉到最小值

    __dequeue_entity(cfs_rq, se);
    __enqueue_entity(cfs_rq, se);                // ← 重新插入 -> 放到红黑树右边
}
```

关键逻辑：`se->vruntime = cfs_rq->min_vruntime` —— 把当前进程的 vruntime 拉到 min_vruntime 的位置，然后重新入队。因为它的 vruntime 被设大了（接近 min_vruntime），红黑树会把它插到右边——接下来调度的就是别人了。

**man 手册的 CAVEATS：**

> `sched_yield()` is intended for use with real-time scheduling policies (i.e., `SCHED_FIFO` or `SCHED_RR`). Use of `sched_yield()` with nondeterministic scheduling policies such as `SCHED_OTHER` (即默认 CFS) is unspecified **and very likely means your application design is broken.**

翻译：`sched_yield()` 是为实时调度设计的。在 CFS 下调它——**大概率是你代码设计有问题。**

原因：
- CFS 用自己的 vruntime 算法做公平调度，你 yield 了，CFS 只是把你的 vruntime 拉到 min_vruntime，如果就绪队列里没有其他进程比你 vruntime 更小，你还是会被调度回来——白白上下文切换一次
- 如果你持有锁就 yield，别的线程跑起来也拿不到锁，白白浪费一次切换

---

## 七、上下文切换的三件开销

一次上下文切换总开销约 **3-10 微秒**，拆成三块：

### 7.1 寄存器保存/恢复（~50ns，占 1%）

进程在 CPU 上跑时，所有瞬时状态都在寄存器里：`rip`（跑到哪了）、`rsp`（栈在哪）、`rax/rbx/...`（运算中间结果）。

切换时这些全部保存到 PCB，再把 next 的寄存器从它的 PCB 加载回来。几十纳秒，最小头。

### 7.2 TLB 刷新（~500ns，占 10%）

**TLB（Translation Lookaside Buffer，地址翻译旁路缓存）** 是 CPU 内部的一块高速缓存，存着最近用过的"虚拟地址 → 物理地址"映射对。

```
进程 A 跑久了 → TLB 里全是 A 的页表项
→ 切换进程 → 加载 B 的页表基地址到 CR3 寄存器
→ CPU 硬件检测到 CR3 变了 → 自动清空所有 TLB 条目
→ B 第一次访问任何地址 → TLB 未命中 → 去内存里查页表（慢 100 倍）
→ 查到的映射填回 TLB（下次就快了）
```

**TLB 命中 ~1ns，TLB 未命中（查内存页表）~100ns。** 切换后最初几百次内存访问全是未命中——这是"TLB 冷启动"的代价。

### 7.3 缓存污染（~5000ns，占 89%）← 最贵

进程 A 长时间运行，CPU 的 L1/L2/L3 缓存里全是 A 的热数据：

```
切换到 B → B 加载自己的数据 → A 的热数据被挤出缓存（污染）
再切回 A → A 的数据全没了 → 全部从主存重新加载
```

**L1 缓存 ~1ns vs 主存 ~100ns —— 差两个数量级。** 一旦缓存被污染，切换回来时大量缓存未命中，性能断崖式下跌。

### 7.4 总开销汇总

```
寄存器操作：     ~50ns     （占 1%）
TLB 重新建温：   ~500ns    （占 10%）
缓存重新建温：   ~5000ns   （占 89%）← 最贵
─────────────────────────────────
合计 ≈ 3-10μs
```

所以 min_granularity=1ms 是精确计算过的：10μs / 1000μs = 1% 开销比。如果把时间片砍到 0.1ms，10% 的 CPU 就全花在"换人"上了。

---

## 八、IO 密集型 vs CPU 密集型 —— 时间线分析

### 8.1 场景

```
进程 A：CPU 密集型，持续做数学计算
进程 B：IO 密集型，每跑 4ms 发起磁盘 IO（阻塞 8ms）
两者 nice=0，targeted_latency=20ms, min_granularity=1ms
```

### 8.2 时间线

| 时段 | 谁在跑 | A 的 vruntime | B 的 vruntime | 事件 |
|:---:|:-----:|:------------:|:------------:|:----|
| 0-4ms | **A** | 4 | 0（阻塞） | B 在做 IO，不在就绪队列 |
| 4-8ms | **A** | 8 | 0（阻塞） | |
| 8-10ms | **A** | 10 | 0（阻塞） | |
| 10ms | — | 10 | 0 | **B IO 完成，恢复就绪** |
| 10-12ms | **B ←** | 10 | 2 | CFS：B=0 < A=10，选 B |
| 12-14ms | **B** | 10 | 4 | B 跑完 4ms → 发起 IO → 阻塞 |
| 14-18ms | **A** | 14 | 4（阻塞） | |
| 18-22ms | **A** | 18 | 4（阻塞） | |
| 22ms | — | 18 | ~10 | **B IO 完成**，min_vruntime 补偿到 ~10 |
| 22-24ms | **B ←** | 18 | 12 | CFS：B=10 < A=18，又选 B |

### 8.3 结论

| 指标 | CPU 密集型 | IO 密集型 |
|:----|:---------:|:---------:|
| 总 CPU 时间 | 更多 | 更少 |
| 响应延迟 | 一般 | **优秀** |
| vruntime 趋势 | 线性增长 | 停滞期 + 缓慢增长 |

**CFS 不需要 MLFQ 那种"手动标记 IO 进程并提升优先级"的 hack**——一个 vruntime 公式自然让它恢复就绪后 vruntime 更小，优先被调度。这就是 CFS 被称为 "elegant" 的原因。

---

## 九、总结：CFS 为什么优雅

| 对比维度 | MLFQ | CFS |
|:--------|:----|:----|
| 优先级模型 | 离散的多级队列 | 连续的权重值 |
| 时间片 | 固定长度 | **按进程数动态计算** |
| 公平性 | 高优先级可抢占低优，有饥饿风险 | vruntime 保证所有进程最终都分配到 CPU |
| IO 处理 | 手动提升优先级（策略 hack） | **vruntime 自动解决** |
| 配置参数 | 多（队列数、升降级规则…） | 少（就 latency + granularity 两个） |

**一句话总结**：CFS 用**数学代替了策略**。MLFQ 说"优先级高的先跑"，CFS 说"大家公平地跑，高优先级的虚拟时钟走得慢一些——但谁都不会被饿死"。

> **补充**：Linux 6.6（2023 年）用 **EEVDF** 替代了 CFS。EEVDF 在 vruntime 基础上增加了截止时间（deadline）机制，进一步降低调度延迟。但核心思想一致——理解 CFS，EEVDF 就是顺水推舟。

---

> **许可**：欢迎转载，署名并附原文链接即可。
>
> **参考资料**：
> - Linux 内核源码 `kernel/sched/fair.c` —— CFS 的完整实现
> - OSTEP（Operating Systems: Three Easy Pieces）—— 第 9 章步调调度，第 10 章多处理器调度
> - 小林 coding：https://xiaolincoding.com/ —— 图解清晰，入门友好
> - Linux man-pages: `man 2 sched_yield`, `man 7 sched`
