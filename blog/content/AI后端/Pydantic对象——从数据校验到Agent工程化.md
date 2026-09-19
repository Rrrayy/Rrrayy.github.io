# Pydantic对象——从数据校验到Agent工程化

## 问题背景

在 FastAPI 和 Agent 中，程序经常要处理来自 HTTP 请求、环境变量和大模型的外部数据。这些数据可能缺少字段、类型错误，或者包含未约定的内容。

如果始终使用普通字典处理，校验逻辑就会分散在各个函数中。Pydantic 的作用，是把数据结构和校验规则集中起来，在数据进入业务逻辑之前完成检查。

本文从 Pydantic 对象的基本概念开始，介绍 `BaseModel`、`Field`、`ConfigDict` 和常用类型约束，再说明它们在 Agent 开发中的使用方式。

## 一、Pydantic对象

### 1.1 Pydantic是什么

Pydantic 是一个用于数据校验和序列化的 Python 库。它的核心不是某个单独的函数，而是一套“根据类型声明处理数据”的模型机制。

在 Pydantic 中，模型通常继承自 `BaseModel`。`BaseModel` 是 Pydantic 提供的基类，负责读取字段定义、执行运行时校验以及提供序列化方法。

可以把它理解为：

> `BaseModel` 是一个带有类型校验和数据转换能力的 Python 类基类。

因此，平时所说的“Pydantic 对象”，通常就是继承 `BaseModel` 的模型类所创建出来的实例。

例如：

```python
from pydantic import BaseModel


class User(BaseModel):
	user_id: int
	user_name: str
```

`User` 是我们定义的模型类，`user_id` 和 `user_name` 是模型字段。创建对象时，Pydantic 会根据字段注解检查输入数据：

```python
user=User(
	user_id=1,
	user_name="Rray",
)
```

因此，Pydantic 对象和普通 Python 对象的区别在于：它不仅保存数据，还保存了数据的结构和校验规则。

### 1.2 和字典有什么区别

普通字典没有固定结构：

```python
user_data={
	"user_id":1,
	"user_name":"Rray",
}
```

后续代码需要自己判断字段是否存在、类型是否正确以及是否允许多余字段。Pydantic 模型则把这些约定写在类定义中。

| 类型 | 运行时校验 | 序列化能力 | 主要用途 |
|:---|:---:|:---:|:---|
| `dict` | 无 | 手动处理 | 临时数据 |
| 普通类 | 自行实现 | 自行实现 | 复杂行为对象 |
| `dataclass` | 默认没有 | 自行处理 | 结构清晰的内部数据 |
| `TypedDict` | 主要依赖静态检查 | 无 | 只需要类型提示的字典 |
| `BaseModel` | 有 | 内置 | 外部输入和数据边界 |

这并不意味着所有数据都应该使用 Pydantic。临时的局部数据使用字典更直接；拥有复杂生命周期和行为的对象，也不应该强行变成数据模型。Pydantic 更适合处理跨越模块或系统边界的数据。

### 1.3 字段类型

模型字段使用 Python 类型注解描述。比如 `int` 表示整数，`str` 表示字符串。

如果字段只能取固定值，可以使用 `Literal`。`Literal` 是 Python 类型系统中的一种类型约束，表示字段只能等于列出的值：

```python
from typing import Literal

from pydantic import BaseModel


class Message(BaseModel):
	role: Literal["user","assistant","tool"]
	content: str
```

这里的 `role` 不是任意字符串，只能是三个值之一。`Literal` 不是 Pydantic 独有的类，而是 Python 提供的类型工具；Pydantic 会读取它并在运行时执行校验。

如果传入不允许的值，模型创建会失败。对于需要集中管理、复用或附加行为的枚举值，可以使用 `Enum`。`Literal` 更适合简单的固定值约束，`Enum` 更适合具有独立语义的状态集合。

### 1.4 常用方法

Pydantic v2 中，最常用的方法有以下几个。

`model_validate` 用于把字典或对象转换为模型对象：

```python
data={
	"user_id":1,
	"user_name":"Rray",
}

user=User.model_validate(data)
```

`model_dump` 把模型对象转换成字典，`model_dump_json` 把模型转换成 JSON 字符串：

```python
user_data=user.model_dump()
user_json=user.model_dump_json()
```

如果输入本身已经是 JSON 字符串，可以使用 `model_validate_json`：

```python
user=User.model_validate_json(
	'{"user_id":1,"user_name":"Rray"}'
)
```

`model_json_schema` 用于生成 JSON Schema。FastAPI 可以根据模型生成接口文档，Agent 也可以使用参数模型生成工具描述：

```python
tool_schema=User.model_json_schema()
```

这些方法对应一条常见的数据链：JSON 字符串 → Python 字典 → Pydantic 对象 → Python 字典或 JSON 字符串。解析、校验、业务处理和序列化分别承担不同职责。

### 1.5 校验和转换

Pydantic 不只是检查输入是否符合类型，还可能根据目标类型进行转换。例如，普通模式下字符串形式的数字可能被转换成整数，嵌套字典也可能被转换成对应的模型对象。

因此，Pydantic 更准确的定位是“带解析能力的数据校验框架”，而不是单纯的静态类型检查器。`TypedDict` 主要服务于类型提示，Pydantic 则会在程序运行时处理输入数据。

`strict=True` 可以减少这类隐式转换，但严格模式也应该根据数据来源决定。配置文件、表单数据和模型生成的 JSON，适合的策略可能并不相同。

### 1.6 嵌套模型

Pydantic 的价值不只在于校验单个字段，也可以递归校验一整棵数据结构：

```python
class ChatRequest(BaseModel):
	messages: list[Message]
```

创建 `ChatRequest` 时，列表中的每个元素都会按照 `Message` 的规则校验。实际的 Agent 请求通常包含消息列表、工具调用列表和工具结果，嵌套模型可以把这些结构表达成稳定的数据契约。

## 二、Field和ConfigDict

类型注解只能描述基本类型。字段范围、默认值、别名和额外字段等规则，需要通过 `Field` 和 `ConfigDict` 补充。

### 2.1 Field

`Field` 用于配置单个字段。它既可以定义默认值，也可以增加约束、说明和别名。

```python
from pydantic import BaseModel, Field


class SearchArguments(BaseModel):
	keyword: str=Field(
		min_length=1,
		max_length=100,
		description="搜索关键词",
	)
	page: int=Field(
		default=1,
		ge=1,
	)
	page_size: int=Field(
		default=20,
		ge=1,
		le=100,
	)
```

这里的约束分别表示：

| 写法 | 作用 |
|:---|:---|
| `default=1` | 字段未传入时使用默认值 |
| `default_factory=list` | 每次创建对象时生成一个新的可变对象 |
| `ge=1` | 数值大于等于 `1` |
| `gt=0` | 数值大于 `0` |
| `le=100` | 数值小于等于 `100` |
| `lt=100` | 数值小于 `100` |
| `min_length=1` | 字符串或集合的最小长度 |
| `max_length=100` | 字符串或集合的最大长度 |
| `pattern=...` | 字符串必须符合指定正则表达式 |
| `description=...` | 为接口文档或工具 Schema 提供说明 |
| `alias="..."` | 指定外部数据使用的字段名 |
| `validation_alias="..."` | 指定校验输入时使用的别名 |

约束的价值在于把规则放在数据模型中，而不是让每个业务函数重复判断。例如 `page_size` 的范围只需要定义一次，FastAPI、工具调用和测试都可以复用。

`Field` 适合表达通用、局部、声明式的约束。它不应该承担所有业务判断。例如，`page_size<=100` 可以写在字段上；“开始时间必须早于结束时间”属于多个字段之间的关系，更适合使用模型级校验；“当前用户是否有权限访问资源”则需要业务服务结合数据库或权限系统判断。

可以把校验职责分成三层：

```text
字段类型与范围 → 字段或模型校验 → 权限、数据库和外部服务规则
```

这样可以避免把复杂业务逻辑全部塞进 Pydantic 模型。

Pydantic v2 提供了 `field_validator` 和 `model_validator`。前者适合补充单个字段的特殊校验，后者适合检查多个字段之间的关系。它们仍然属于数据模型校验，不能替代权限判断、数据库查询和外部服务调用。

### 2.2 默认值

固定默认值可以直接写在字段上：

```python
class AgentConfig(BaseModel):
	model_name: str="mock-model"
	temperature: float=0.7
```

列表、字典和时间等需要每次重新创建的值，应使用 `default_factory`：

```python
from pydantic import BaseModel, Field


class TraceInfo(BaseModel):
	tags: list[str]=Field(default_factory=list)
```

`default_factory=list` 会在每次创建 `TraceInfo` 时生成新的列表，避免不同对象意外共享同一份可变数据。

### 2.3 别名

当外部字段名和 Python 属性名不一致时，可以使用别名：

```python
from pydantic import BaseModel, Field


class User(BaseModel):
	user_name: str=Field(alias="userName")
```

配置模型中也可以使用 `validation_alias` 读取环境变量：

```python
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
	model_name: str=Field(
		default="mock-model",
		validation_alias="MODEL_NAME",
	)
```

程序内部使用 `settings.model_name`，部署环境使用 `MODEL_NAME`，两者职责清晰。

输入名称和输出名称不一定相同。`validation_alias` 主要用于读取外部输入，序列化时可以使用 `serialization_alias`，并通过 `model_dump(by_alias=True)` 输出外部协议要求的字段名。这样同一个模型可以连接“外部名称、内部 Python 名称和外部输出名称”三个层次。

### 2.4 ConfigDict

`ConfigDict` 用于设置整个模型的行为。

`strict=True` 可以减少隐式类型转换：

```python
from pydantic import BaseModel, ConfigDict


class ToolArguments(BaseModel):
	model_config=ConfigDict(strict=True)
	user_id: int
```

在直接传入 Python 对象时，`user_id="12"` 不会被当作正常整数。严格模式是否适合使用，要根据数据来源判断；配置读取和兼容旧接口有时需要保留一定的转换能力。

`extra` 用于处理模型没有声明的字段：

```python
class ToolArguments(BaseModel):
	model_config=ConfigDict(extra="forbid")
	user_id: int
```

它有三种常见取值：

- `ignore`：忽略额外字段；
- `forbid`：出现额外字段时校验失败；
- `allow`：保留额外字段。

工具参数通常适合 `forbid`，因为错误的字段名应该尽早暴露；配置模型通常可以使用 `ignore`，避免其他环境变量影响当前程序。

如果字段使用别名，同时希望输入时接受字段名和别名，可以使用：

```python
model_config=ConfigDict(
	validate_by_name=True,
	validate_by_alias=True,
)
```

`validate_by_name` 和 `validate_by_alias` 适用于较新的 Pydantic v2 版本，旧版本项目需要先确认配置项是否可用。

`frozen=True` 用于禁止模型字段重新赋值，`validate_assignment=True` 用于在字段被修改时再次执行校验。前者适合不可变上下文，后者适合需要更新的状态对象。

## 三、类型约束

### 3.1 Literal和Enum

`Literal` 直接限制字段的可选值：

```python
class Response(BaseModel):
	status: Literal["success","error"]
```

如果状态值需要被多个模块复用，或者需要附加方法，可以使用 `Enum`。两者都能参与 Pydantic 校验，选择标准是是否需要独立的枚举语义。

### 3.2 Any

`Any` 表示不对字段内容施加具体类型约束：

```python
from typing import Any


class ProviderPayload(BaseModel):
	payload: Any
```

不同模型供应商的原始响应结构可能不同，接收层可以暂时使用 `Any` 保留数据。但 `Any` 会推迟类型检查，真正进入工具执行和业务核心的数据仍应转换为具体模型。

### 3.3 Union和可选字段

联合类型表示字段允许多种类型：

```python
class ToolResult(BaseModel):
	result: str | dict[str, object]
```

`str | None` 表示字段允许为空。若字段还可以省略，需要同时提供默认值：

```python
class UserProfile(BaseModel):
	display_name: str | None=None
```

联合类型适合协议本身确实存在多种形态的情况。如果不同类型对应完全不同的处理流程，使用带判别字段的多个模型通常更清晰。

## 四、Agent中的应用

### 4.1 请求和响应

FastAPI 可以直接使用 Pydantic 模型描述接口：

```python
from fastapi import FastAPI
from pydantic import BaseModel


class ChatRequest(BaseModel):
	message: str


class ChatResponse(BaseModel):
	answer: str


app=FastAPI()


@app.post("/chat",response_model=ChatResponse)
async def chat(request: ChatRequest)->ChatResponse:
	return ChatResponse(
		answer=f"收到：{request.message}",
	)
```

请求进入路由时，FastAPI 会校验 `ChatRequest`；返回值会按照 `ChatResponse` 序列化。缺少字段或类型不正确时，接口会在入口处返回校验错误。

### 4.2 工具参数

工具参数来自大模型生成的 JSON，不能直接解包后调用函数。先定义参数模型：

```python
class UserProgressArguments(BaseModel):
	model_config=ConfigDict(
		strict=True,
		extra="forbid",
	)
	user_id: int=Field(ge=1)
```

执行工具前校验参数：

```python
import json

arguments=json.loads(raw_arguments)
validated=UserProgressArguments.model_validate(arguments)
result=await get_user_progress(**validated.model_dump())
```

这段代码的关键不在于方法数量，而在于调用顺序：先解析 JSON，再校验字段，最后执行工具。解析失败和校验失败都应该被转换成可处理的工具错误，而不是直接让 Agent 进程崩溃。

### 4.3 配置

配置模型可以统一管理环境变量、默认值和类型：

```python
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
	model_name: str=Field(
		default="mock-model",
		validation_alias="MODEL_NAME",
	)
	timeout: float=Field(
		default=10.0,
		gt=0,
		validation_alias="MODEL_TIMEOUT",
	)
```

程序启动时就可以完成配置读取和校验，避免服务运行到第一次请求时才发现配置错误。

### 4.4 结构化输出

如果希望模型返回固定结构，可以先定义输出模型：

```python
class ArticleOutline(BaseModel):
	title: str=Field(min_length=1)
	sections: list[str]=Field(min_length=1)
```

模型返回 JSON 后，使用 `model_validate_json` 校验：

```python
outline=ArticleOutline.model_validate_json(raw_content)
```

Pydantic 只能检查结果是否符合模型，不能保证模型一定返回合法 JSON 或正确的业务含义。实际流程还需要配合提示词、JSON 输出模式以及失败重试。

工具参数的完整链路可以理解为：

```text
Pydantic模型 → JSON Schema → 大模型生成参数 → model_validate → 执行工具
```

JSON Schema 是提供给模型的结构说明，`model_validate` 才是程序真正执行工具前的运行时防线。前者不能替代后者，因为模型仍然可能生成缺少字段、字段名错误或取值越界的参数。

## 五、工程边界

### 5.1 数据边界

Pydantic 最适合放在外部数据进入系统的边界上：外部输入 → 解析 → Pydantic 校验 → 内部业务对象 → 业务执行。

“宽松接收”不等于放弃校验，而是先保留供应商差异，等获得足够上下文后再转换为具体模型。工具执行、数据库写入和外部请求发送之前，仍应进行严格校验。

在 Agent 中，可以把校验分成三层：

- 对象级：字段是否存在、类型是否正确、嵌套结构是否符合模型；
- 跨对象：工具调用 ID 是否有对应结果、消息顺序是否符合协议；
- 流程级：是否允许调用工具、是否需要重试、是否超过循环次数。

Pydantic 主要负责第一层，第二层和第三层需要由 Agent 执行器或状态管理逻辑完成。

### 5.2 错误处理

`ValidationError` 包含字段位置、错误类型和说明：

```python
from pydantic import ValidationError


try:
	User.model_validate({"user_id":"wrong"})
except ValidationError as error:
	print(error.errors())
```

API 层可以把它转换为客户端错误；Agent 层可以提取必要信息，让模型重新生成参数；内部任务则应保留完整日志。用户输入错误、模型输出错误和程序内部错误，需要分别处理。

### 5.3 序列化选项

`exclude_none=True` 会排除值为 `None` 的字段，`exclude_unset=True` 会排除创建对象时没有显式传入的字段。更新接口时，两者的含义不同：前者关注当前值，后者关注调用方是否提供过字段。

因此，字段缺失、字段存在但值为 `None`、字段存在且有具体值，可能代表三种不同状态。PATCH 请求、工具参数和模型输出都可能依赖这种区别，不能只把“可选字段”理解成一个简单的开关。

### 5.4 Pydantic的边界

Pydantic 可以保证单个对象的结构正确，但不能独立保证整个 Agent 流程正确。工具调用 ID 是否匹配、消息顺序是否符合协议、工具是否被重复执行、失败后是否重试，都需要由 Agent 执行器和状态管理逻辑负责。

同样，Pydantic 模型也不应该承担数据库事务、权限判断和复杂业务行为。它负责数据契约，业务服务负责行为。

## 总结

Pydantic 通过 `BaseModel`、`Field` 和 `ConfigDict` 把数据结构与校验规则集中起来，并用 `model_validate`、`model_dump` 等方法连接外部数据和内部对象。在 Agent 开发中，它适合处理接口请求、工具参数、配置和结构化输出，但它只负责对象级数据校验，跨对象关系、执行状态和业务规则仍需要由其他模块保证。

本人能力有限，文章如有错误或遗漏之处，欢迎指正。

## 参考资料

1. [Pydantic 官方文档](https://docs.pydantic.dev/latest/)
2. [Pydantic Fields](https://docs.pydantic.dev/latest/concepts/fields/)
3. [FastAPI 官方文档：Request Body](https://fastapi.tiangolo.com/tutorial/body/)
