# Python 异步编程

学习 FastAPI 和 Agent 时，经常会遇到 `async`、`await` 和事件循环。理解它们的执行过程，才能判断哪些操作可以并发，哪些代码会阻塞程序。

下面先区分进程、线程和协程，再看异步调用在 FastAPI 和 Agent 中的实际用法。

## 一、进程、线程和协程

进程是操作系统分配资源的基本单位。一个进程拥有独立的地址空间、文件描述符和其他系统资源，进程之间默认不能直接访问对方的内存，因此隔离性较强，但创建和切换的成本也比较高。

线程是进程中的执行单元。同一个进程里的多个线程共享地址空间和大部分资源，线程之间可以直接访问同一份数据，所以通信比较方便；但共享数据也带来了竞态、锁和线程安全问题。线程由操作系统调度，线程切换发生在内核控制下。

协程通常运行在线程之上。多个协程可以共用一个线程，它们不会由操作系统强制切换，而是在代码执行到 `await` 等位置时主动交出执行权。协程的切换成本较低，但前提是协程不能长时间执行阻塞代码，否则同一线程上的其他协程都会被卡住。

可以把三者简单理解为：进程负责资源隔离，线程负责执行，协程负责在同一线程内组织可暂停的任务。它们并不是互相替代的关系，一个进程可以包含多个线程，一个线程也可以运行多个协程。

本文关注的是协程。要让多个协程按照等待状态轮流执行，还需要一个负责调度它们的机制，这就是事件循环。

## 二、协程与事件循环

协程可以看成一种能够暂停和恢复的函数。普通函数从第一行执行到最后一行，中途不能主动交出执行权；协程执行到 `await` 时，可以暂时停下来，把执行机会交给其他任务，等待的操作完成后再继续。

事件循环是负责调度协程的管理者。它不断检查哪些任务已经准备好、哪些任务正在等待 I/O，然后运行当前可以继续执行的任务。事件循环通常运行在线程中，异步程序正是通过这种“等待时切换任务”的方式提高线程利用率。

事件循环需要一个入口才能启动，`asyncio.run` 就是常用的入口。后面的示例会从同步调用开始，先观察等待时间，再改成协程。

## 三、同步调用

先用两个耗时相近的函数模拟外部工具：

```python
import time


def load_user():
	time.sleep(2)
	return "user loaded"


def load_orders():
	time.sleep(2)
	return "orders loaded"


start_time=time.perf_counter()
user=load_user()
orders=load_orders()
elapsed=time.perf_counter()-start_time

print(user,orders)
print(f"elapsed: {elapsed:.2f}s")
```

两个函数之间没有数据依赖，理论上可以同时等待，但同步写法只能先执行 `load_user`，它返回以后才会执行 `load_orders`。因此总耗时大约是两次等待时间之和。

这里的 `sleep` 只是模拟网络请求。真实场景中，数据库查询、HTTP 请求和模型调用都可能在等待数据返回。等待期间，CPU 并没有持续计算，但当前线程被同步调用占住了。

## 四、异步函数

把函数改成异步函数：

```python
import asyncio


async def load_user():
	await asyncio.sleep(2)
	return "user loaded"
```

调用 `load_user()` 时，并不会立即得到字符串，而是得到一个协程对象：

```python
result=load_user()
print(result)
```

这里打印出的不是函数返回值，而是一个协程对象。它只是对“以后如何执行这段异步代码”的描述；如果既不 `await`，也不创建 Task，函数体就不会执行，程序结束时还可能出现“协程从未等待”的警告。只有把它交给事件循环，代码才会真正运行。最简单的方式是使用 `asyncio.run`：

```python
async def main():
	result=await load_user()
	print(result)


asyncio.run(main())
```

`await` 可以理解为一次主动让出执行权的操作。执行到 `await asyncio.sleep(2)` 时，当前协程暂时挂起，事件循环可以去运行其他已经准备好的任务。等待结束后，事件循环再恢复这个协程。

需要注意，`await` 等待的是一个可等待对象，常见的包括协程对象、Task 和 Future。`async def` 只是定义了协程函数，并不代表函数调用会自动并发。

## 五、串行与并发

下面两种写法看起来很接近，执行效果却不同。

第一种仍然是串行等待：

```python
async def main():
	user=await load_user()
	orders=await load_orders()
	print(user,orders)
```

第一个 `await` 返回以后，第二个协程才开始执行。函数虽然是异步的，但两个操作没有并发起来。

如果两个工具之间没有依赖，可以先创建任务，再统一等待：

```python
async def main():
	user_task=asyncio.create_task(load_user())
	orders_task=asyncio.create_task(load_orders())
	user,orders=await asyncio.gather(user_task,orders_task)
	print(user,orders)


start_time=time.perf_counter()
asyncio.run(main())
elapsed=time.perf_counter()-start_time
print(f"elapsed: {elapsed:.2f}s")
```

`create_task` 会把协程登记为事件循环可以调度的任务，`gather` 则负责等待这些任务全部结束并收集结果。返回值的顺序与传入任务的顺序一致，不会因为某个任务先完成就改变位置。两个任务都在等待时，线程可以交替推进它们，因此总耗时通常接近其中最长的一次等待，而不是两次等待之和。

这不是多线程。这里仍然可以只有一个线程，任务在等待 I/O 时交替执行。如果任务本身是大量 CPU 计算，事件循环不会因为 `async` 自动获得并行计算能力。

## 六、FastAPI 和 Agent

FastAPI 中使用 `async def` 声明的路由会在事件循环中执行；使用普通 `def` 声明的路由，则由框架放到线程池中执行。路由函数里如果要等待异步 I/O，应使用 `async def`，并且不能在已经运行的事件循环中再次调用 `asyncio.run`。

```python
import asyncio

from fastapi import FastAPI

app=FastAPI()


@app.get("/summary")
async def summary():
	user_task=asyncio.create_task(load_user())
	orders_task=asyncio.create_task(load_orders())
	user,orders=await asyncio.gather(user_task,orders_task)
	return {"user":user,"orders":orders}
```

一次 Agent 请求也可以采用同样的结构。比如先同时查询知识库和用户配置，再把两份结果交给后续模型调用：

```python
async def call_tool(tool_name):
	await asyncio.sleep(1)
	return f"{tool_name} result"


async def run_agent():
	knowledge_task=asyncio.create_task(call_tool("knowledge"))
	profile_task=asyncio.create_task(call_tool("profile"))
	knowledge,profile=await asyncio.gather(
		knowledge_task,
		profile_task,
	)
	return f"{knowledge}; {profile}"
```

这里能否并发，取决于两个工具之间是否存在数据依赖。如果第二个工具必须使用第一个工具的返回值，就不能为了追求并发强行拆开。并发优化的前提是先确认任务之间可以独立执行。

## 七、阻塞调用

下面的代码虽然使用了 `async def`，但仍然会阻塞事件循环：

```python
async def bad_tool():
	time.sleep(2)
	return "done"
```

`time.sleep` 不会把控制权交还给事件循环。只要它运行，当前线程就会停在那里，其他协程也无法得到执行机会。

异步代码中应优先使用异步库，例如用 `asyncio.sleep` 模拟等待；如果只能调用同步函数，可以把它放到线程中执行：

```python
async def call_blocking_tool():
	return await asyncio.to_thread(load_user)
```

这并不会把同步函数变成真正的异步函数，而是避免它直接占住事件循环线程。数据库驱动、HTTP 客户端等组件应优先选择与异步模型匹配的实现，否则接口函数写成 `async def` 也不能带来预期效果。

## 八、超时、异常和取消

工具调用不能只考虑正常返回。一个外部服务可能迟迟不响应，也可能在并发任务中途失败。可以为单次工具调用设置超时：

```python
async def call_with_timeout(tool_name):
	try:
		async with asyncio.timeout(3):
		return await call_tool(tool_name)
	except TimeoutError:
		return f"{tool_name} timeout"
```

多个任务一起等待时，异常处理策略需要提前确定。`asyncio.gather` 默认会把异常传给调用方；如果希望收集每个任务的结果和异常，可以使用 `return_exceptions=True`：

```python
results=await asyncio.gather(
		call_tool("knowledge"),
		call_tool("profile"),
		return_exceptions=True,
	)

for result in results:
	if isinstance(result,BaseException):
		print(f"tool failed: {result}")
	else:
		print(result)
```

取消也是异步程序的正常路径。客户端断开连接、请求超时或上层任务结束时，正在等待的协程可能收到 `asyncio.CancelledError`。如果捕获它，通常应先完成清理，再继续抛出，而不是悄悄吞掉取消信号：

```python
async def long_tool():
	try:
		await asyncio.sleep(10)
		return "done"
	except asyncio.CancelledError:
		print("tool cancelled")
		raise
```

在 Agent 场景中，超时、异常和取消都应转换成明确的调用结果或上层错误，不能让某一个工具无限等待，拖住整个请求。

## 总结

Python 异步编程的核心，是让协程在等待 I/O 时把执行权交给事件循环，再由事件循环调度其他任务。`async def` 定义协程，`await` 暂停当前协程，`create_task` 和 `asyncio.gather` 可以并发等待相互独立的操作；但 `time.sleep` 等阻塞调用仍会卡住事件循环。FastAPI 和 Agent 中使用异步时，除了判断任务能否并发，还要处理超时、异常、取消和资源清理。

本人能力有限，文章如有错误或遗漏之处，欢迎指正。
