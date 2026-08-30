# C++ 移动语义与完美转发

## 问题背景

```cpp
std::string name="Rray";
std::string copied=name;
std::string moved=std::move(name);
```

`copied` 会复制字符串内容，`moved` 则可能直接接管 `name` 的内部资源。

`std::move` 不负责移动数据。它只把 `name` 转成右值，让程序能够调用移动构造函数。真正转移资源的是移动构造函数。

移动语义用于转移对象管理的资源。右值引用支持移动构造，转发引用和完美转发用于泛型参数传递。

---

## 一、为什么需要移动语义

下面定义一个自行管理堆内存的类型：

```cpp
class Buffer{
public:
	Buffer(const char* text){
		size_=std::strlen(text);
		data_=new char[size_+1];
		std::memcpy(data_,text,size_+1);
	}

	Buffer(const Buffer& other){
		size_=other.size_;
		data_=new char[size_+1];
		std::memcpy(data_,other.data_,size_+1);
	}

	~Buffer(){
		delete[] data_;
	}

private:
	char* data_=nullptr;
	std::size_t size_=0;
};
```

```cpp
Buffer first("a very long string");
Buffer second=first;
```

拷贝构造需要重新申请内存并复制字符。当源对象是即将销毁的临时对象时，这次复制没有必要：

```cpp
Buffer create_buffer(){
	return Buffer("temporary string");
}

Buffer value=create_buffer();
```

临时对象即将销毁，其管理的内存可以直接转交给 `value`，这正是移动语义要解决的问题。

把下面的移动构造函数加入 `Buffer` 类：

```cpp
Buffer(Buffer&& other)noexcept{
	data_=other.data_;
	size_=other.size_;

	other.data_=nullptr;
	other.size_=0;
}
```

对当前这个 `Buffer` 来说，移动构造不需要重新申请字符数组，也不需要复制字符，只需接管指针并让源对象进入可析构状态。

因此，移动语义的核心是转移对象持有的资源，而不是复制资源内容：

> 把对象管理的资源所有权转移给另一个对象。

移动完成后，源对象仍处于有效状态，但其具体值未作规定。它可以被析构和重新赋值，其他操作则必须遵循类型的接口约定，不能假定其仍保留移动前的内容。

### 构造过程的输出验证

可以给三个特殊构造函数加上日志，直接观察拷贝和移动：

```cpp
class Demo{
public:
	Demo(){
		std::cout<<"default\n";
	}

	Demo(const Demo&){
		std::cout<<"copy\n";
	}

	Demo(Demo&&)noexcept{
		std::cout<<"move\n";
	}
};

Demo first;
Demo second=first;
Demo third=std::move(first);
```

典型输出为：

```text
default
copy
move
```

其中的 `move` 来自移动构造函数，而不是 `std::move`。该实验说明，`std::move` 只改变表达式的值类别，实际资源转移仍由移动构造函数完成。

需要注意，`std::string` 可能使用 SSO 保存短字符串。短字符串移动时不一定存在可直接接管的堆内存，因此“移动通常是 O(1)”不能无条件适用于所有对象和字符串长度。

---

## 二、右值引用与 `std::move`

左值和右值描述的是表达式的值类别，而不是对象的固有属性。变量名表达式通常是左值，临时对象表达式通常是右值：

```cpp
std::string text="hello";
```

临时结果通常是右值：

```cpp
std::string("hello")
create_buffer()
```

`std::move(text)` 产生将亡值，表示对象仍然存在，但其资源可以被转移。

右值引用可以绑定临时对象和将亡值：

```cpp
void consume(Buffer&& value);

consume(Buffer("temporary"));
```

移动构造函数也因此写成：

```cpp
Buffer(Buffer&& other)noexcept;
```

`other` 虽然声明为右值引用，但在函数体内是有名字的变量，因此表达式 `other` 仍属于左值。若要将其继续传递给移动接口，需要再次进行右值转换：

```cpp
consume(std::move(other));
```

`std::move` 的核心可以简化成：

```cpp
template<typename T>
std::remove_reference_t<T>&& move(T&& value){
	return static_cast<std::remove_reference_t<T>&&>(value);
}
```

该函数只进行类型转换，不负责申请、释放或搬运资源。如果类型没有可用的移动构造函数，即使使用 `std::move`，仍可能调用拷贝构造。

还要注意 `const`：

```cpp
const std::string source="hello";
std::string target=std::move(source);
```

这里的结果是 `const std::string&&`。移动构造通常需要修改源对象，把内部指针置空；`const` 对象不能被修改，所以这段代码通常会退回拷贝构造。

移动构造通常应标记为 `noexcept`。`vector` 扩容时，如果移动可能抛异常而拷贝可用，为保证异常安全，标准库可能选择拷贝；声明 `noexcept` 后，容器才可以优先使用移动。

---

## 三、转发引用与完美转发

下面的 `std::string&&` 是普通右值引用：

```cpp
void process(std::string&& value);
```

它只能接收右值。

下面的 `T&&` 在满足模板类型推导条件时属于转发引用，旧资料中也常称为万能引用：

```cpp
template<typename T>
void process(T&& value);
```

传入右值时：

```cpp
T=std::string
T&&=std::string&&
```

传入左值时：

```cpp
T=std::string&
T&&=std::string& &&
```

第二种情况会触发引用折叠：

| 组合 | 折叠结果 |
|:--|:--|
| `T& &&` | `T&` |
| `T& &` | `T&` |
| `T&& &` | `T&` |
| `T&& &&` | `T&&` |

因此，同一个转发引用参数可以接收左值和右值。

但是，参数在函数体内具有名字后，其表达式值类别变为左值：

```cpp
void call(std::string& value){
	std::cout<<"左值版本\n";
}

void call(std::string&& value){
	std::cout<<"右值版本\n";
}

template<typename T>
void wrapper(T&& value){
	call(value);
}
```

```cpp
std::string text="hello";
wrapper(text);
wrapper(std::string("temporary"));
```

第二次调用传入右值，但 `call(value)` 仍选择左值重载，原因是 `value` 在当前作用域内是有名字的变量。

使用 `std::forward` 可以恢复调用者传入时的值类别：

```cpp
template<typename T>
void wrapper(T&& value){
	call(std::forward<T>(value));
}
```

它根据 `T` 的推导结果进行条件转换：实参原来是左值时保持左值，原来是右值时恢复为右值。

二者的语义区别如下：

| 工具 | 含义 |
|:--|:--|
| `std::move` | 我明确放弃这个对象的资源 |
| `std::forward` | 调用者传进来是什么值类别，我就保持什么值类别 |

因此，显式转移资源时使用 `std::move`，泛型包装函数传递参数时使用 `std::forward`。

---

## 四、参数包与折叠表达式

参数包使模板能够接收任意数量的类型和参数：

```cpp
template<typename... Args>
void print_count(Args&&... args){
	std::cout<<sizeof...(Args)<<"\n";
}
```

```cpp
print_count(1,3.14,"hello");
```

`sizeof...(Args)` 得到参数包中的参数个数。

C++17 的折叠表达式可以直接展开参数包：

```cpp
template<typename... Args>
auto sum(Args... args){
	return (args+...);
}
```

`sum(1,2,3,4)` 会展开成类似：

```cpp
(((1+2)+3)+4)
```

如果参数需要继续传递给其他函数，可以将参数包与完美转发组合使用：

```cpp
template<typename Callable,typename... Args>
void call_all(Callable&& callable,Args&&... args){
	std::invoke(
		std::forward<Callable>(callable),
		std::forward<Args>(args)...
	);
}
```

这里的 `Callable&&` 接收可调用对象，`Args&&...` 接收任意数量的实参，`std::forward` 保留每个实参的原始值类别。代码需要包含 `<functional>`。

---

## 五、通用工厂与 `emplace_back`

标准库的 `std::make_unique` 使用了这套机制。其核心逻辑可以简化为：

```cpp
template<typename T,typename... Args>
std::unique_ptr<T> make_object(Args&&... args){
	return std::unique_ptr<T>(
		new T(std::forward<Args>(args)...)
	);
}
```

调用时，构造参数会以原有值类别转发给 `T` 的构造函数：

```cpp
class User{
public:
	User(std::string name,int age)
		:name_(std::move(name)),age_(age){
	}

private:
	std::string name_;
	int age_=0;
};

auto user=make_object<User>("Rray",21);
```

`emplace_back` 采用相同的参数转发机制：

```cpp
std::vector<User> users;

users.push_back(User("Rray",21));
users.emplace_back("Rray",21);
```

第一种写法先构造临时 `User`，再将临时对象移动到容器；第二种写法将参数直接转发给 `User` 构造函数，在容器存储区中原地构造对象。

`emplace_back` 并不意味着任何场景下都更快：

```cpp
User user("Rray",21);
users.emplace_back(user);
```

对象已经存在时仍然需要拷贝。需要在容器内部直接构造对象时可使用 `emplace_back`；插入已有对象时，`push_back` 的意图通常更加明确。

---

## 总结

1. **移动语义**：通过转移对象持有的资源，避免不必要的资源复制；移动后的源对象仍然有效，但具体状态由类型决定。
2. **右值引用**：为移动构造和右值重载提供匹配基础；`std::move` 只改变表达式的值类别，不直接执行资源转移。
3. **完美转发**：转发引用结合引用折叠接收左值和右值，`std::forward` 保留实参原本的值类别，避免泛型包装函数改变调用语义。
4. **参数包**：配合折叠表达式和完美转发，可以实现接收任意数量参数的通用接口，`make_unique` 和 `emplace_back` 都采用了类似机制。

本人能力有限，文章如有错误或遗漏之处，欢迎指正。

---

## 参考资料

1. cppreference 
2. 《Effective Modern C++》
