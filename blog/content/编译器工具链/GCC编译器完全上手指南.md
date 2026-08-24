# g++ 从入门到忘记

习惯用vscode的运行键一键编译，当接触我的第一个项目时，发现怎么能把多个文件合到一块运行。gcc刚好帮我解决了这个问题........

---

## 1. gcc 和 g++ 到底什么关系


**g++ 是 GCC 套件里专门编译 C++ 的。** 

那 `gcc` 和 `g++` 的区别是什么？

- `gcc` 编译 C 文件，不会自动链接 C++ 标准库
- `g++` 编译 C++ 文件，自动链接 C++ 标准库（`libstdc++`）

当你用 `gcc` 去编译一个 `.cpp` 时，链接时会报一堆 `undefined reference to std::xxx`，因为 `gcc` 不知道要拉 C++ 标准库。`g++` 会自动处理这件事。

验证一下，这是用 `gcc` 编译 `.cpp` 的错误： 解决方法有两种，一是继续用`gcc`不过需要手动加`-lstdc++` ，第二种就方便多了，直接用`g++`编译即可

![gcc编译cpp报错](images/gcc-vs-gpp-error.png)



---

## 2. 装 g++
由于本人在linux平台上进行开发，所以这里只提供linux系统上的安装以及版本查看指令....
### Linux（Ubuntu/Debian）

```bash
sudo apt update
sudo apt install g++

# 验证
g++ --version
```

输出大概长这样：

```
g++ (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0
Copyright (C) 2023 Free Software Foundation, Inc.

```


---

## 3. 编写简单cpp程序，使用G++编译

简单实现hello g++代码 

`hello.cpp`：

```cpp
#include <iostream>

int main(){
	std::cout << "Hello, g++!\n";
	return 0;
}
```

编译运行

```bash
g++ hello.cpp -o hello
./hello
```

输出：

```
Hello, g++!
```

命令拆开：`g++` 调用编译器，`hello.cpp` 源文件，`-o hello` 指定输出文件名。不写 `-o` 生成 `a.out`。
读到这里，你可能会有疑惑，-o到底是什么意思，怎么就能把一个源文件变成可执行文件，如果你有计算机系统基础，那么你可能知道到底发生了什么。

---

## 4. 拆开编译，竟有四个阶段

你敲 `g++ hello.cpp -o hello`，里面其实跑完了四步：

```
源文件 (.cpp)--->[1] 预处理 (Preprocessing) --->.i  文件（展开 #include、#define）--->[2] 编译 (Compilation) --->.s  汇编文件
--->[3] 汇编 (Assembly) --->.o  目标文件（机器码）--->[4] 链接 (Linking) --->可执行文件
```
不过，在现实场景中，只需要`g++ xxx -o`即可一键代替这四个阶段

### 4.1 准备例子

`math.cpp`：

```cpp
#include <iostream>
#include <cmath>       
#define AUTHOR "rr"   // 宏，预处理阶段展开

int main(){
	double x = 4.0;
	double y = std::sqrt(x);    
	std::cout << "Author: " << AUTHOR << "\n";
	std::cout << "sqrt(" << x << ") = " << y << "\n";
	return 0;
}
```

### 4.2 阶段一：预处理

```bash
g++ -E math.cpp -o math.i
```

`-E` 告诉 g++：**只做预处理，到这就停**。

```bash
# 知识补充：wc -l 统计行数，-w 单词数，-c 字节数
wc -l math.cpp    # 输出:11 math.cpp
wc -l math.i      # 输出:46756 math.i

# 看最后几行，AUTHOR 已经被替换成 "rr" 
tail -5 math.i
# 找到输出：std::cout << "Author: " << "rr" << "\n";
```

C++ 的头文件比 C 的庞大很多——`<iostream>` 展开后行数远超 `<stdio.h>`，里面全是模板和流的声明。这也是 C++ 编译比 C 慢的一个原因：每个 `.cpp` 都要独立展开一遍头文件。

### 4.3 阶段二：编译

把预处理后的代码翻译成汇编：

```bash
g++ -S math.i -o math.s
# 或者一步到位
g++ -S math.cpp -o math.s
```

看生成的汇编：
输入指令：
```
cat math.s
```
完整汇编代码
```
		.file	"math.cpp"
	.text
#APP
	.globl _ZSt21ios_base_library_initv
	.section	.rodata
.LC1:
	.string	"Author: "
.LC2:
	.string	"rr"
.LC3:
	.string	"\n"
.LC4:
	.string	"sqrt("
.LC5:
	.string	") = "
#NO_APP
	.text
	.globl	main
	.type	main, @function
main:
.LFB2585:
	.cfi_startproc
	endbr64
	pushq	%rbp
	.cfi_def_cfa_offset 16
	.cfi_offset 6, -16
	movq	%rsp, %rbp
	.cfi_def_cfa_register 6
	subq	$16, %rsp
	movsd	.LC0(%rip), %xmm0
	movsd	%xmm0, -16(%rbp)
	movq	-16(%rbp), %rax
	movq	%rax, %xmm0
	call	sqrt@PLT
	movq	%xmm0, %rax
	movq	%rax, -8(%rbp)
	leaq	.LC1(%rip), %rax
	movq	%rax, %rsi
	leaq	_ZSt4cout(%rip), %rax
	movq	%rax, %rdi
	call	_ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc@PLT
	movq	%rax, %rdx
	leaq	.LC2(%rip), %rax
	movq	%rax, %rsi
	movq	%rdx, %rdi
	call	_ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc@PLT
	movq	%rax, %rdx
	leaq	.LC3(%rip), %rax
	movq	%rax, %rsi
	movq	%rdx, %rdi
	call	_ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc@PLT
	leaq	.LC4(%rip), %rax
	movq	%rax, %rsi
	leaq	_ZSt4cout(%rip), %rax
	movq	%rax, %rdi
	call	_ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc@PLT
	movq	%rax, %rdx
	movq	-16(%rbp), %rax
	movq	%rax, %xmm0
	movq	%rdx, %rdi
	call	_ZNSolsEd@PLT
	movq	%rax, %rdx
	leaq	.LC5(%rip), %rax
	movq	%rax, %rsi
	movq	%rdx, %rdi
	call	_ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc@PLT
	movq	%rax, %rdx
	movq	-8(%rbp), %rax
	movq	%rax, %xmm0
	movq	%rdx, %rdi
	call	_ZNSolsEd@PLT
	movq	%rax, %rdx
	leaq	.LC3(%rip), %rax
	movq	%rax, %rsi
	movq	%rdx, %rdi
	call	_ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc@PLT
	movl	$0, %eax
	leave
	.cfi_def_cfa 7, 8
	ret
	.cfi_endproc
.LFE2585:
	.size	main, .-main
	.section	.rodata
	.type	_ZNSt8__detail30__integer_to_chars_is_unsignedIjEE, @object
	.size	_ZNSt8__detail30__integer_to_chars_is_unsignedIjEE, 1
_ZNSt8__detail30__integer_to_chars_is_unsignedIjEE:
	.byte	1
	.type	_ZNSt8__detail30__integer_to_chars_is_unsignedImEE, @object
	.size	_ZNSt8__detail30__integer_to_chars_is_unsignedImEE, 1
_ZNSt8__detail30__integer_to_chars_is_unsignedImEE:
	.byte	1
	.type	_ZNSt8__detail30__integer_to_chars_is_unsignedIyEE, @object
	.size	_ZNSt8__detail30__integer_to_chars_is_unsignedIyEE, 1
_ZNSt8__detail30__integer_to_chars_is_unsignedIyEE:
	.byte	1
	.align 8
.LC0:
	.long	0
	.long	1074790400
	.ident	"GCC: (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0"
	.section	.note.GNU-stack,"",@progbits
	.section	.note.gnu.property,"a"
	.align 8
	.long	1f - 0f
	.long	4f - 1f
	.long	5
0:
	.string	"GNU"
1:
	.align 8
	.long	0xc0000002
	.long	3f - 2f
2:
	.long	0x3
3:
	.align 8
4:

```
是不是一脸懵逼了，没事，都这样。但是注意几点，你会发现
   1.字符串常量
  .LC1:    .string    "Author: "
  .LC2:    .string    "rr"

  代码里的字符串在汇编里直接摆在这。

   2.名字修饰（Name Mangling）—— C++ 特有的现象
  call    sqrt@PLT                           ← C 函数，名字干干净净
  call    _ZStlsISt11char_traitsIcEERSt13... ← C++ 的 cout，一长串乱码

  区别很明显：sqrt 就叫 sqrt，但 cout 变成了 _ZStls...。因为 C++ 支持函数重载，编译器必须给每个重载版本编一个唯一的名字。用 c++filt 能还原：
  执行该代码
  ```
  rr@rr-VMware-Virtual-Platform:~/桌面$ c++filt _ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc
std::basic_ostream<char, std::char_traits<char> >& std::operator<< <std::char_traits<char> >(std::basic_ostream<char, std::char_traits<char> >&, char const*)

  ```

  哦。原来就这。。这就是 cout <<。这就是 C++ 名字修饰——有重载就必须修饰，C 没有重载所以不用修饰。


### 4.4 阶段三：汇编

汇编 → 机器码：

```bash
g++ -c math.s -o math.o
# 或者
g++ -c math.cpp -o math.o
```

看目标文件里的符号：

```bash
file math.o
# 输出:math.o: ELF 64-bit LSB relocatable, x86-64, version 1 (SYSV), not stripped

nm math.o
# 别想多了，nm是name list的意思，用于查看目标文件中有哪些符号(例如函数，变量....)
# 输出:
# 0000000000000000 T main
#                 U sqrt
#                 U _ZNSolsEd
#0000000000000019 r _ZNSt8__detail30__integer_to_chars_is_unsignedIjEE
#000000000000001a r _ZNSt8__detail30__integer_to_chars_is_unsignedImEE
#000000000000001b r _ZNSt8__detail30__integer_to_chars_is_unsignedIyEE
#                 U _ZSt21ios_base_library_initv
#                 U _ZSt4cout
#                 U _ZStlsISt11char_traitsIcEERSt13basic_ostreamIcT_ES5_PKc
# T:当前函数在你目前的文件里实现了
# U:说明符号引用了但没有实现，需要链接时去别的文件里找
# r:只读数据(常量,类型标记...)
```

### 4.5 阶段四：链接

把 `.o` 和库拼在一起，补上所有未定义符号：

```bash
g++ math.o -o math -lm
```

`-lm` 链接数学库(libm.so)。C++ 标准库默认链接，不需要额外指定。

```bash
./math_demo
# 输出:
#Author: rr
#sqrt(4) = 2

```

### 4.6 小结

| 阶段 | 命令 | 输入 → 输出 | 产物 |
|------|------|-------------|-----------|
| 预处理 | `g++ -E` | `.cpp` → `.i` | 纯文本，展开后的 C++ 代码 |
| 编译 | `g++ -S` | `.i` → `.s` | 纯文本，汇编代码（能看到名字修饰） |
| 汇编 | `g++ -c` | `.s` → `.o` | 二进制，未链接的机器码 |
| 链接 | `g++` | `.o` → 可执行 | 二进制，完整的可执行文件 |

`g++ math.cpp -o math` 就是背后默默跑完了上面四步。

---

## 5. 常用编译选项

### 5.1 输出控制

```bash
-o <file>         # 指定输出文件名（不写默认 a.out）
-c                # 只编译到 .o，不链接
-S                # 只编译到汇编 (.s)
-E                # 只做预处理
-save-temps       # 保留所有中间文件 (.i .s .o)
```

### 5.2 警告

```bash
-Wall              # 常用警告（不是 all，是最常用的那批）
-Wextra            # 额外警告
-Werror            # 警告当成错误，有警告就编译失败
-Wpedantic         # 严格标准检查
-Wshadow           # 变量名遮蔽警告（C++ 里特别有用）

# 日常组合
g++ -Wall -Wextra -Werror program.cpp -o program
```

`-Wshadow` 在 C++ 里值得单独开——成员变量和局部变量同名的时候会提醒你，这种 bug 不太好找。

### 5.3 优化等级

```bash
-O0     # 不优化（默认），调试用
-O1     # 轻度优化
-O2     # 标准优化，发布版本推荐
-O3     # 激进优化
-Os     # 优化体积
```

```bash
g++ -Wall -Wextra -g -O0 main.cpp -o main

```

### 5.4 调试信息

```bash
-g         # 生成调试信息（GDB 用）
```

### 5.5 语言标准

```bash
-std=c++17   # C++17（目前最稳）
-std=c++20   # C++20（concept、ranges、模块等新特性）
-std=c++23   # C++23（部分特性还没完全支持）

# 强制严格标准
g++ -std=c++20 -Wpedantic main.cpp -o main
```

GCC 对 C++20 的完整支持要到 GCC 12 以上，GCC 14 基本全覆盖。用 C++20 之前先确认版本。

### 5.6 路径与链接

```bash
-I<path>        # 头文件搜索路径
-L<path>        # 库文件搜索路径
-l<name>        # 链接 libname.a 或 libname.so

# 例子
g++ -I./include -L./lib -lfoo main.cpp -o main
```


---

## 6. 多文件编译

### 6.1 先看结构

```
calc/
├── main.cpp       # 入口
├── calc.hpp       # 声明
└── calc.cpp       # 实现
```

### 6.2 代码

calc.hpp —— 头文件，声明有啥函数：

```cpp
#ifndef CALC_HPP
#define CALC_HPP

double add(double a, double b);
double sub(double a, double b);
double mul(double a, double b);
double div(double a, double b);

#endif
```

calc.cpp —— 实现：

```cpp
#include "calc.hpp"
#include <stdexcept>

double add(double a, double b){ return a + b; }
double sub(double a, double b){ return a - b; }
double mul(double a, double b){ return a * b; }
double div(double a, double b){
	if(b == 0.0) throw std::runtime_error("除数为零");
	return a / b;
}
```

main.cpp —— 主程序：

```cpp
#include <iostream>
#include "calc.hpp"

int main(){
	double x = 10.0, y = 3.0;
	std::cout << x << " + " << y << " = " << add(x, y) << "\n";
	std::cout << x << " - " << y << " = " << sub(x, y) << "\n";
	std::cout << x << " * " << y << " = " << mul(x, y) << "\n";
	std::cout << x << " / " << y << " = " << div(x, y) << "\n";
	return 0;
}
```

### 6.3 一步到位

```bash
g++ main.cpp calc.cpp -o calc
./calc
```

文件少可以这样，但每次改一个文件全部重编，效率低。

### 6.4 分步编译

```bash
# 各编各的
g++ -c main.cpp -o main.o
g++ -c calc.cpp -o calc.o

# 链接
g++ main.o calc.o -o calc
```

改一个文件只需要重编那个文件再链接就行。

---

## 7. 静态库 vs 动态库

### 7.1 静态库

```bash
# 编译目标文件
g++ -c calc.cpp -o calc.o

# ar = archive，把 .o 打包成 .a 文件
# rcs = 替换/创建/索引
ar rcs libcalc.a calc.o

# -L.  告诉编译器在当前目录(.)找库
# -lcalc  链接 libcalc.a（省略lib和.a，自动匹配）
g++ main.cpp -L. -lcalc -o calc
```

静态库直接塞进可执行文件，搬哪都能跑。

### 7.2 动态库

```bash
# -fPIC = Position Independent Code（位置无关代码）
# 动态库加载地址不确定，这个指令记得加奥
g++ -c -fPIC calc.cpp -o calc.o

# -shared 生成共享库（.so = Shared Object）
g++ -shared calc.o -o libcalc.so

g++ main.cpp -L. -lcalc -o calc
```

运行的时候大概率报错：

```
rr@rr-VMware-Virtual-Platform:~/桌面$ ./calc
./calc: error while loading shared libraries: libcalc.so: cannot open shared object file: No such file or directory
```
因为系统不知道去哪找这个 `.so` 文件：

```bash
# LD_LIBRARY_PATH = 告诉系统去哪搜 .so
# .=当前目录，$LD_LIBRARY_PATH=保留原来的路径
export LD_LIBRARY_PATH=.:$LD_LIBRARY_PATH
./calc
# 你会发现 运行成功了...

```

---


g++背后的原理相当复杂，本人能力有限，参考学习了诸多资料，加以个人想法生成了该文章。作为c++开发爱好者，g++是要掌握的，在日常开发中，`g++ xxx.cpp -o xxx` 一键生成可执行文件，再带上 `-Wall -Wextra -g -O0`，大部分编译问题都能搞定。今后本人会针对C++ 开发路线中的知识细节问题进行学习心得分享，感谢观看。


