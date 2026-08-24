---
title: malloc(1) 背后的 brk 与 mmap
date: 2026-07-11
tags: glibc, malloc, brk, mmap, ptmalloc
categories: 操作系统
---

# malloc(1) 背后的 brk 与 mmap

> **glibc 版本**：本文所有源码分析基于 glibc 2.39，实验环境为 Ubuntu 24.04 x86_64。

> 学习操作系统内存管理时，常看到"小内存走 brk，大内存走 mmap"的描述，但很少见到说明 brk 一次扩展的具体量级。我用三行代码做了个实验：malloc(1) 前后分别调 sbrk(0) 观察堆顶地址，结果发现 brk 一次性扩展了 132 KB。这个量级远大于 1 字节的请求。带着这个疑问查阅了 glibc 源码，发现背后涉及 chunk 管理、top chunk 机制、mmap 阈值判定和 free 路径选择等一系列设计。本文记录了完整的实验过程和源码分析笔记。

---

## 一、实验：malloc(1) 触发了什么？

malloc 底层通过 brk 或 mmap 实现，但没有说明 brk 一次扩展多少。

```c
#include<stdio.h>
#include<stdlib.h>
#include<unistd.h>

int main(){
    printf("heap top: %p\n", sbrk(0));
    int *p1 = (int*)malloc(1);
    printf("heap top now: %p\n", sbrk(0));
    printf("malloc addr: %p\n", p1);
    free(p1);
    return 0;
}
```

`sbrk(0)` 返回当前堆顶地址，在 malloc 前后各调一次，差值就是堆扩展的大小。

编译运行：

```bash
rr@rr-VMware-Virtual-Platform:~/os_lab/malloc_test$ gcc demo1.c -o demo1
rr@rr-VMware-Virtual-Platform:~/os_lab/malloc_test$ ./demo1
```

输出：

```
heap top:     0x6248b68aa000
heap top now: 0x6248b68cb000
malloc addr:  0x6248b68aa6b0
```

堆顶从 `0x6248b68aa000` 移到 `0x6248b68cb000`，增量 `0x21000` = 132 KB。malloc(1) 实际触发了 132 KB 的堆扩展，远大于请求的 1 字节。

再用 strace 从系统调用层面确认一下：

```bash
rr@rr-VMware-Virtual-Platform:~/os_lab/malloc_test$ strace ./demo1 2>&1 | grep -E 'brk|mmap'
```

输出：

```
brk(NULL)                               = 0x6371eb416000
mmap(NULL, 8192, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x77f0e861d000
mmap(NULL, 71343, PROT_READ, MAP_PRIVATE, 3, 0) = 0x77f0e860b000
mmap(NULL, 2170256, PROT_READ, MAP_PRIVATE|MAP_DENYWRITE, 3, 0) = 0x77f0e8200000
mmap(0x77f0e8228000, 1605632, PROT_READ|PROT_EXEC, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x28000) = 0x77f0e8228000
mmap(0x77f0e83b0000, 323584, PROT_READ, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x1b0000) = 0x77f0e83b0000
mmap(0x77f0e83ff000, 24576, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x1fe000) = 0x77f0e83ff000
mmap(0x77f0e8405000, 52624, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_FIXED|MAP_ANONYMOUS, -1, 0) = 0x77f0e8405000
mmap(NULL, 12288, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x77f0e8608000
brk(NULL)                               = 0x6371eb416000
brk(0x6371eb437000)                     = 0x6371eb437000
```

前面 8 个 mmap 是动态链接器加载 libc.so 等共享库时产生的——程序调 printf、malloc，它们的代码在 libc.so 里，必须先加载到内存。真正与 malloc 相关的，是最后两条 brk：

```
brk(NULL)                   = 0x6371eb416000    ← sbrk(0) 查当前堆顶
brk(0x6371eb437000)         = 0x6371eb437000    ← malloc(1) 触发的堆扩展
```

`0x6371eb416000` → `0x6371eb437000`，增量 0x21000 = 132 KB。未观察到 mmap，因为 1 字节请求远低于 mmap 阈值（默认 128 KB）。

实验结论明确，但留下一个问题：**glibc 为什么一次性申请 132 KB，而不是仅扩展 4 KB 或恰好满足请求的 1 字节？**   
要回答这个问题，需要先了解 glibc 管理内存的基本单位。

---

## 二、glibc 管理内存的基本单位：chunk

查阅 glibc 源码 `malloc/malloc.c`，发现 glibc 管理堆内存的基本单位是 **chunk**。每个 chunk 有一个固定格式的头部，一个 chunk 在内存中的布局如下（以 64 位系统为例）：

```
低地址
  ┌──────────────────────────────┐
  │ mchunk_prev_size  (8 字节)    │  ← 前一个 chunk 的大小（前一个空闲时有效）
  ├──────────────────────────────┤
  │ mchunk_size      (8 字节)    │  ← 当前 chunk 大小 + 低 3 位标志位
  ├══════════════════════════════┤  ← 以上 16 字节是固定元数据
  │ 用户数据（fd/bk 等在此复用）     │  ← malloc 返回的指针指向这里
  │ 大小 ≥ 16 字节                │
  │                              │
  └──────────────────────────────┘
高地址
```
源码中定义如下：

```c
struct malloc_chunk {
    INTERNAL_SIZE_T      mchunk_prev_size;  // 前一个 chunk 的大小（仅在前一个 chunk 空闲时才有意义，用于合并空闲块）
    INTERNAL_SIZE_T      mchunk_size;       // 当前 chunk 的大小，低 3 位借用作标志位

    // 以下字段仅在 chunk 空闲时有效（分配给用户后，这片内存被用户数据覆盖）
    struct malloc_chunk* fd;  // 前驱指针，指向前一个空闲 chunk
    struct malloc_chunk* bk;  // 后继指针，指向后一个空闲 chunk

    // 仅 largebin 中的大块空闲 chunk 使用，跳过不匹配的块加速查找
    struct malloc_chunk* fd_nextsize;
    struct malloc_chunk* bk_nextsize;
};
```

（可以在 glibc 源码仓库的 `malloc/malloc.c` 中搜索 `struct malloc_chunk` 查看完整定义。）

`mchunk_size` 的低 3 位被借用作标志位——由于 chunk 按 16 字节对齐，低 3 位必然为 0，因此可以复用。

| 位 | 宏 | 含义 |
|:---|:---|:-----|
| bit 0 | PREV_INUSE | 前一个 chunk 正在使用（未空闲） |
| bit 1 | IS_MMAPPED | 该 chunk 由 mmap 分配 |
| bit 2 | NON_MAIN_ARENA | 该 chunk 属于非主 arena |

这里出现的 arena 可以理解为 glibc 管理堆内存的一个"工作区"，下面讲的 tcache、各种 bin、top chunk 都在 arena 里。单线程时只有一个主 arena（main_arena），多线程时 glibc 会为各线程分配独立的 arena 以减少锁竞争，这类 arena 就叫非主 arena。位 2 置 1 就表示这个 chunk 来自非主 arena。

注意一个设计细节：**fd、bk 等指针字段仅在 chunk 空闲时有效。** 当 chunk 被分配给用户后，这片内存被用户数据覆盖。换句话说，每个 chunk 只有前 16 字节（mchunk_prev_size + mchunk_size）是固定不变的元数据，后面的指针字段在分配出去时"借"给了用户数据，不额外占空间。

对 malloc(1) 而言，glibc 实际分配的 chunk 大小为：16 字节头部 + 至少 16 字节用户数据，合计 **32 字节**。

用户数据区最小 16 字节的原因在于：**chunk 被 free 后会进入空闲链表，它的用户数据区要被 `fd` 和 `bk` 两个指针复用**。64 位系统上一个指针 8 字节，fd + bk 共 16 字节。如果用户数据区小于 16 字节，free 后就放不下这两个指针，无法链入空闲链表。因此 glibc 强制每个 chunk 的用户数据区至少 16 字节，你 malloc(1) 虽然只要 1 字节，但底层按这个最小粒度分配。这就是"malloc(1) 最小 chunk 32 字节"的完整含义。

这里需要区分两个不同层级的对齐要求：glibc 的 chunk 按 **16 字节** 对齐（保证 mchunk_size 低 3 位可用于标志位），而内核的 brk/mmap 接口按 **4 KB（页）** 对齐。两者互不冲突——glibc 向内核申请页对齐的大块内存，再在内部按 16 字节对齐切割成 chunk。

但 32 字节只是 glibc 层面的分配粒度。实验中内核返回了 132 KB——glibc 从这 132 KB 中切出 32 字节给用户后，剩下的空间怎么管理？这引出了 glibc 的分层分配路径和 top chunk 机制。

---

## 三、glibc 的分配路径

继续阅读 `malloc/malloc.c` 中的 `__libc_malloc` 和 `_int_malloc` 函数，可以看到 malloc 的分配路径是分层的，每一层都是一个缓存。整理自 glibc 2.39 源码的实际调用顺序：

```mermaid
flowchart LR
    A["__libc_malloc"] --> B{"tcache?"}
    B -->|"有"| C["直接返回"]
    B -->|"无"| D["_int_malloc"]

    D --> E{"fastbin?"}
    E -->|"是"| F["返回"]
    E -->|"否"| G{"smallbin?"}
    G -->|"是"| H["返回"]
    G -->|"否"| I["unsorted bin"]

    I --> J{"精确匹配?"}
    J -->|"是"| K["返回"]
    J -->|"否"| L["归类"]

    L --> M{"largebin?"}
    M -->|"是"| N["返回"]
    M -->|"否"| O{"top chunk?"}
    O -->|"够"| P["切割返回"]
    O -->|"不够"| Q["sysmalloc"]

    Q --> R{"大小?"}
    R -->|"≥128KB"| S["mmap"]
    R -->|"<128KB"| T["brk"]
```

能触发 brk 的场景只有一个：**当前 arena 中的所有缓存（tcache、各类 bin、top chunk）都无法满足分配请求**。

首次 malloc(1) 时，这些缓存全都为空，所以分配路径从第一级一直走到最后一级。在往下看之前，有必要先了解这几层缓存分别是什么。

· **tcache（线程缓存）**— 每个线程私有的仓库，最快因为不用加锁，LIFO 顺序，每个 bin 默认存 7 个。
· **fastbin（快速bin）**— 最近 free 的小块内存，单链表结构，不合并相邻空闲块，大小一般在 64 字节以下。
· **smallbin（小bin）**— 固定大小的小块内存，双链表，每种大小一个独立的 bin，查找是 O(1)。
· **unsorted bin（未排序bin）**— 中转站。刚 free 的 chunk 先扔这里，下次 malloc 时遍历它，如果能精确匹配大小就直接用，否则归类到对应的 smallbin 或 largebin 里。
· **largebin（大bin）**— 大块内存，每个 bin 覆盖一个大小范围，用 skip list 加速查找。
· **top chunk（堆顶储备）**— 堆顶的最后备用区域，上面这些全都不满足时才从它这里切；如果 top chunk 也不够，就调 sysmalloc 向内核要。

可以把它们类比成 CPU 的多级缓存：tcache 像 L1（最快但最小）→ fastbin/small bin 像 L2 → unsorted/large bin 像 L3 → top chunk 像内存条 → sysmalloc 像去硬盘取数据。每一层都在试图避免进入下一层，因为系统调用涉及用户态到内核态的切换，开销是数百个 CPU 周期。

首次 malloc(1) 时，各级缓存全部为空，top chunk 也尚未初始化，所以分配路径一口气走到最后一级，触发 brk——这就是实验一中 132 KB 的来源。

后续的 malloc 调用，只要前 5 步中任意一步命中，就不会触发系统调用。glibc 减少用户态和内核态互相切换的核心思路是：**能复用就不新申请**。

至此，首次 malloc(1) 触发 brk 的原因清楚了：各级缓存全部为空。但 brk 具体扩展多少，还需要看 top chunk 的初始大小计算。

---

## 四、top chunk 与 132 KB 的来源

### 4.1 top chunk 是什么

top chunk 是位于堆顶（最高地址）的特殊 chunk。它不属于任何 bin，因为bin 管理的是已经被 free 的 chunk，而是作为 arena 的"储备空间"。当所有 bin 都无法满足分配请求时，malloc 从 top chunk 中切割。

top chunk 没有 fd/bk 指针（因为它不在空闲链表中），其大小由 sbrk 扩展后的末地址减去已分配 chunk 的总大小决定。

### 4.2 132 KB 的实验事实

查阅 glibc 2.39 的 `sysmalloc()` 函数，可以看到首次堆扩展的公式：

```c
// glibc malloc/malloc.c — sysmalloc() 中 main_arena 首次扩展的逻辑
size = nb + mp_.top_pad + MINSIZE;
if (contiguous (av))
    size -= old_size;
size = ALIGN_UP (size, pagesize);
```

各参数值：
- `nb` = 32（malloc(1) 对齐后的 chunk 大小）
- `mp_.top_pad` = 0（`DEFAULT_TOP_PAD` 默认为 0）
- `MINSIZE` = 32（最小 chunk 大小，即 `offsetof(struct malloc_chunk, fd_nextsize)` 对齐后）
- `old_size` = 0（首次分配，top chunk 尚未初始化）
- 页对齐后计算结果为 4 KB

然而 strace 实际观测结果是 132 KB（33 页），与公式直接计算结果不符。这说明 brk 扩展 132 KB 并非完全由 `sysmalloc()` 中这一段公式决定——132 KB 可能来自初始化路径（`ptmalloc_init()`）或内存管理系统底层的行为。由于作者对这部分源码的理解还不够深入，暂不给出 132 KB 的精确推导，待进一步学习之后，会出此方面的理解。

从内核返回 132 KB 后，glibc 将前 32 字节作为用户 chunk 返回，剩余 135,136 字节成为 top chunk，后续小分配从此处切割。

### 4.3 验证：后续 malloc 零系统调用

如果 132 KB 是 glibc 一次性通过 brk 申请的，那么后续的 malloc 应该不会再次触发 brk。通过程序验证：

```c
#include<stdio.h>
#include<stdlib.h>
#include<unistd.h>

int main(){
    void *p1 = malloc(1);
    void *p2 = malloc(100);
    void *p3 = malloc(1000);
    printf("p1: %p  p2: %p  p3: %p\n", p1, p2, p3);
    free(p1); free(p2); free(p3);
    return 0;
}
```

观察 brk 和 mmap 系统调用：

```bash
rr@rr-VMware-Virtual-Platform:~/os_lab/malloc_test$ strace ./demo2 2>&1 | grep -E 'brk|mmap'
brk(NULL)                               = 0x619c65d0d000
mmap(NULL, 8192, ...)                                  ← lib 加载，非 malloc 行为
mmap(NULL, 71343, ...)
mmap(NULL, 2170256, ...)
mmap(0x..., 1605632, ...)
mmap(0x..., 323584, ...)
mmap(0x..., 24576, ...)
mmap(0x..., 52624, ...)
mmap(NULL, 12288, ...)
brk(NULL)                               = 0x619c65d0d000
brk(0x619c65d2e000)                     = 0x619c65d2e000    ← 仅一次 brk 扩展
```

三次 malloc 仅触发了一次 brk，后两次均未产生系统调用。这是因为 top chunk 在首次 brk 后拥有约 135 KB 的空闲空间，第二次和第三次 malloc 直接在 top chunk 中完成切割：

```
malloc(100)
  → tcache 无空闲
  → fastbin/smallbin 无空闲
  → top chunk（剩余 ~135 KB）满足请求
  → 从 top chunk 头部切出对齐后的 32 字节，返回给用户
  → top chunk 起始地址后移，大小减小
  → 零系统调用
```

一次 brk 的系统调用成本摊到后续多次 malloc 上，平均每次接近零。这就是 glibc 的批量预分配、按需零散分配策略。

---

## 五、mmap 阈值与路径切换

### 5.1 M_MMAP_THRESHOLD 的设计

brk 管理的堆是连续线性区域。小内存用 brk 分配效率较高（仅修改一个指针），但如果用 brk 分配大块内存后再 free，堆区可能产生无法回收的"空洞"——除非 free 的 chunk 恰好与 top chunk 相邻。相邻时两者会合并成更大的 top chunk，堆顶下移，brk 可以回缩释放内存；不相邻时中间夹着正在使用的 chunk，堆顶动不了，所以空洞就存在了。

mmap 分配的内存是独立的 VMA（虚拟内存区域），free 时通过 munmap 可以完全释放，不会产生堆内碎片。代价是 mmap/munmap 每次涉及页表的建立和拆除，系统调用开销比 brk 更大。

阈值 `M_MMAP_THRESHOLD`（默认 128 KB）正是在两种机制间做取舍：小内存走 brk 以减少系统调用次数，大内存走 mmap 以避免堆区碎片化。

glibc 源码中走 mmap 的条件判定：

```c
// glibc malloc/malloc.c — sysmalloc() 中走 mmap 的条件
if (nb >= mp_.mmap_threshold && (unsigned long)nb >= mp_.mmap_threshold
    && (mp_.n_mmaps < mp_.n_mmaps_max)){
    char *mm = (char *)MMAP(0, size, ...);
}
```

通过 mmap 分配的 chunk 会在头部标记 `IS_MMAPPED` 位（`mchunk_size` 的 bit 1），free 时据此走不同的回收路径。

### 5.2 验证：malloc(1MB) 走 mmap

验证大内存分配路径：

```c
#include<stdio.h>
#include<stdlib.h>
#include<unistd.h>

int main(){
    printf("heap top before: %p\n", sbrk(0));
    int *p = (int*)malloc(1024*1024);
    printf("heap top after:  %p\n", sbrk(0));
    printf("malloc 1MB: %p\n", p);
    free(p);
    return 0;
}
```

```bash
rr@rr-VMware-Virtual-Platform:~/os_lab/malloc_test$ ./demo3
heap top before: 0x6276cf6db000
heap top after:  0x6276cf6fc000
malloc 1MB:      0x7760b8ec6010
```

```bash
rr@rr-VMware-Virtual-Platform:~/os_lab/malloc_test$ strace ./demo3 2>&1 | grep -E 'brk|mmap'
brk(NULL)                               = 0x6185060f8000
  ...（lib 加载的 mmap 省略）
brk(NULL)                               = 0x6185060f8000
brk(0x618506119000)                     = 0x618506119000
mmap(NULL, 1052672, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x754905efc000
```

strace 输出中同时出现了 `brk` 和 `mmap`。`brk(0x618506119000)` 扩展了 132 KB——这是 main arena 尚未初始化时的首次堆扩展，并非为 1 MB 请求而做的分配。`mmap(1052672)` 才是实际分配 1 MB 内存的调用。

注意 mmap 的返回大小是 1052672 字节，而非精确的 1 MB（1048576 字节）。多出的 4096 字节（1 页）是 mmap 映射的页对齐开销和 glibc 管理的元数据空间。这说明 mmap 分配的最小粒度是一页。

这里还有一个细节：**如果先执行一次小 malloc 初始化了 arena，再执行大块内存分配则仅有 mmap 而无 brk**。在该实验之前如果先调一次 malloc(1) 再调 malloc(1MB)，strace 结果中 malloc(1MB) 时只有 mmap，堆顶未变化——因为 arena 已经初始化过了，brk 不需要再次扩展。

### 5.3 malopt 调阈值后的行为验证

如果通过 `mallopt` 将阈值调低，小内存会走 mmap 吗？

```c
mallopt(M_MMAP_THRESHOLD, 1024);
int *p3 = (int*)malloc(2048);  // 2KB > 1024
printf("p3: %p\n", p3);
```

输出：

```
p3: 0x611b5d5446d0
```

p3 的地址 `0x611b5d5446d0` 在堆区范围内——**未触发 mmap**。起初怀疑是阈值未生效，重新分析分配路径后发现：

**glibc 的判定顺序是优先检索空闲内存，再比较阈值。** 此时 top chunk 仍有充足空闲空间，malloc(2048) 在 top chunk 切割阶段即可满足，不会进入阈值判定步骤。

仅当 top chunk 也无法满足时，才会将请求大小与阈值比较，决定走 brk 还是 mmap。这个优先级关系容易被忽略。

---

## 六、free 的两条路径

free 的行为取决于 chunk 头部的标志位。glibc 源码中 `__libc_free()` 的实现：

```c
// glibc malloc/malloc.c — __libc_free()
void __libc_free(void* mem){
    malloc_state* ar_ptr;
    mchunkptr p = mem2chunk(mem);

    if (chunk_is_mmapped(p)){                // 检查 IS_MMAPPED 位
        munmap_chunk(p);                     // → munmap，归还 OS
        return;
    }

    ar_ptr = arena_for_chunk(p);
    _int_free(ar_ptr, p, 0);                 // → 放回 bins/tcache
}
```

**mmap 路径：** 检查 `IS_MMAPPED` 位，如果为 1 → 调用 `munmap_chunk()` → `munmap()` 系统调用 → 内核解除 VMA 映射，物理内存归还给操作系统。

**brk 路径：** 将 chunk 放回 glibc 内部的空闲链表，不调用 brk 回缩。具体流程：

1. 若 chunk 大小 ≤ `MAX_FAST_SIZE`（64 字节），放入 **fastbin**（LIFO 单链表，不合并相邻空闲块）
2. 否则，检查前后 chunk 是否空闲：若空闲则合并，根据合并后大小放入 **unsorted bin** / **smallbin** / **largebin**
3. 若合并后的 chunk 与 top chunk 相邻，直接合并到 top chunk

当 top chunk 的大小超过 `M_TRIM_THRESHOLD`（默认也是 128 KB）时，`malloc_trim()` 可能调用 `brk()` 回缩堆空间。但在实际运行中较少发生——绝大多数长时间运行的程序不会主动收缩堆。

这也解释了一个现象：**长期运行的 server 在反复 malloc/free 小内存后，RSS(物理内存占用)只涨不降**——这并非内存泄漏，而是 glibc 将 freed chunk 缓存在 free list 中供后续复用。
通俗的解释就是，用空间换取时间，glibc将free掉的chunk没有归还给操作系统，而是将free掉的chunk留在了自己的缓存池中，下次malloc同等大小或者比上次分配的内存小的时候，可以直接在缓存池中取走，而不用系统调用。

### 6.1 实验验证：两条 free 路径的不同行为

写一个程序分别验证 mmap 和 brk 两种 free 路径：

```c
#include<stdio.h>
#include<stdlib.h>
#include<unistd.h>

int main(){
    // brk 路径：小内存 free 后不归还 OS
    int *p1 = (int*)malloc(1);
    free(p1);
    printf("小内存 free 完成\n");

    // mmap 路径：大内存 free 后通过 munmap 归还 OS
    int *p2 = (int*)malloc(1024*1024);
    free(p2);
    printf("大内存 free 完成\n");

    pause();  // 暂停，方便 strace 观察
    return 0;
}
```

strace 跟踪：

```bash
strace -e trace=brk,mmap,munmap ./demo_free 2>&1
```

输出：

```
brk(NULL)                               = 0x5ff4083e8000
mmap(NULL, 8192, ...)                                  ← lib 加载，非 malloc 行为
mmap(NULL, 71343, ...)
...（lib 加载的其他 mmap 省略）
munmap(0x..., 71343)                                   ← lib 加载的清理
brk(NULL)                               = 0x5ff4083e8000
brk(0x5ff408409000)                     = 0x5ff408409000    ← malloc(1) 触发 brk 扩展堆
malloc(1) addr: 0x5ff4083e82a0
小内存 free 完成                                        ← ← 没有任何系统调用！chunk 进了缓存
mmap(NULL, 1052672, ...)                = 0x76ece3afc000    ← malloc(1MB) 走 mmap
malloc(1MB) addr: 0x76ece3afc010
munmap(0x76ece3afc000, 1052672)         = 0                ← free(1MB) 触发 munmap 归还 OS
大内存 free 完成
```

可以清楚看到：小内存 free 后没有产生任何 brk/mmap/munmap 系统调用——chunk 被 glibc 缓存了。大内存 free 触发了 `munmap`，将整块内存归还给操作系统。这就是两条 free 路径在系统调用层面的区别。

---

## 七、总结

文章起因是发现malloc(1)不是分配4kb，进而通过程序验证得到132kb,不知从何而来，顺着这个疑问去翻 glibc 源码，从 chunk 结构体一路看到分配路径、top chunk、sysmalloc。整个过程梳理下来，glibc 的设计可以归纳为三层：

- **内核层面**按页扩展，首次 brk 申请 132 KB，分摊系统调用成本。
- **glibc 层面**按需切割，从内核拿回来的大块内存切成 chunk 分配出去，剩余的做 top chunk。
- **free 层面**按策略缓存，小块放 fastbin/tcache，大块进 unsorted/largebin，下次复用。

不过，该篇文章对于 132 KB 的精确计算还没完全搞清楚，阅读sysmalloc源码发现公式算出来是 4 KB，跟 strace 结果对不上，本人会进一步学习深入，后续也会产出相关文章。

---

## 参考资料

1. glibc 2.39 源码 — `malloc/malloc.c`，Ubuntu 24.04 自带
2. `man 3 mallopt` — glibc 内存分配参数调节手册
