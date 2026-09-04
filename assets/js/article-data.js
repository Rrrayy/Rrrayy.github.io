window.blog_articles=[
  {
    "title": "一致性哈希详解：从哈希环到分布式缓存",
    "date": "2026-09-03",
    "category": "分布式系统",
    "tags": [
      "分布式系统",
      "一致性哈希",
      "缓存",
      "哈希"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/164331090",
    "slug": "consistent-hashing",
    "word_count": 3123,
    "reading_time": 7,
    "summary": "假设有一个分布式缓存集群，三台缓存服务器保存用户数据：",
    "prerequisite": "",
    "source_path": "C++新特性/一致性哈希详解——从哈希环到分布式缓存.md"
  },
  {
    "title": "C++ 移动语义与完美转发",
    "date": "2026-08-30",
    "category": "C++ 新特性",
    "tags": [
      "C++",
      "C++11",
      "移动语义",
      "完美转发"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/164191908",
    "slug": "cpp-move-forward",
    "word_count": 2161,
    "reading_time": 5,
    "summary": "copied 会复制字符串内容，moved 则可能直接接管 name 的内部资源。",
    "prerequisite": "",
    "source_path": "C++新特性/C++移动语义与完美转发.md"
  },
  {
    "title": "lambda 闭包原理",
    "date": "2026-08-15",
    "category": "C++ 新特性",
    "tags": [
      "C++",
      "C++11",
      "lambda"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/163764597",
    "slug": "lambda-closure",
    "word_count": 2907,
    "reading_time": 6,
    "summary": "在写代码时经常要给 std::sort 传比较器。有次我需要按\"与某个阈值距离的远近\"排序：",
    "prerequisite": "",
    "source_path": "C++新特性/lambda闭包原理——函数怎么能带走局部变量.md"
  },
  {
    "title": "零拷贝到底快在哪？",
    "date": "2026-07-27",
    "category": "IO 模型",
    "tags": [
      "网络编程",
      "零拷贝",
      "性能优化"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/163222717",
    "slug": "zero-copy",
    "word_count": 2194,
    "reading_time": 5,
    "summary": "传统方案：",
    "prerequisite": "",
    "source_path": "IO模型/零拷贝到底快在哪-sendfile-vs-read-write-benchmark.md"
  },
  {
    "title": "锁的进阶：从自旋锁到手写实现，再到死锁与条件变量",
    "date": "2026-07-21",
    "category": "并发编程",
    "tags": [
      "C++",
      "并发",
      "同步原语"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/163084384",
    "slug": "locks-and-condition-variables",
    "word_count": 4132,
    "reading_time": 9,
    "summary": "本文是多线程编程系列的第二篇，分三部分：自旋锁原理与手写实现、死锁复现与 gdb 定位、条件变量与生产者消费者模型。每部分都有完整代码和实验数据。",
    "prerequisite": "",
    "source_path": "C++多线程编程/锁的进阶-自旋锁-死锁-条件变量.md"
  },
  {
    "title": "C++ 多线程入门：创建线程、加锁、计数",
    "date": "2026-07-17",
    "category": "并发编程",
    "tags": [
      "C++",
      "多线程",
      "并发"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/162950541",
    "slug": "cpp-threads",
    "word_count": 2621,
    "reading_time": 6,
    "summary": "单线程程序像一个人在干活——干完一件才能干下一件。但现实中很多事是可以同时进行的：",
    "prerequisite": "有C++语言基础，有 g++ 编译器基础。本人刚好对g++ 的安装和基本使用发表过相关博客，详情请点击 [g++ 从入门到忘记](https://blog.csdn.net/rr666888/article/details/162645027)",
    "source_path": "C++多线程编程/C++多线程入门-创建线程-加锁-计数.md"
  },
  {
    "title": "ext4文件系统详解：用dd和mkfs.ext4从零解剖",
    "date": "2026-07-14",
    "category": "文件系统",
    "tags": [
      "文件系统",
      "ext4",
      "inode"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/162878654",
    "slug": "ext4-layout",
    "word_count": 4052,
    "reading_time": 9,
    "summary": "学习完本文后，可以解决以下问题：",
    "prerequisite": "",
    "source_path": "文件系统探秘/ext4文件系统详解-用dd和mkfs.ext4从零解剖.md"
  },
  {
    "title": "硬链接和软链接的区别--inode 详解",
    "date": "2026-07-13",
    "category": "文件系统",
    "tags": [
      "文件系统",
      "inode",
      "链接"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/162816776",
    "slug": "inode-links",
    "word_count": 3882,
    "reading_time": 9,
    "summary": "日常学习时会产生几个现实中的疑问",
    "prerequisite": "",
    "source_path": "文件系统探秘/inode-硬链接-软链接探究.md"
  },
  {
    "title": "malloc(1) 背后的 brk 与 mmap",
    "date": "2026-07-11",
    "category": "内存管理",
    "tags": [
      "glibc",
      "malloc",
      "内存管理"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/162793574",
    "slug": "malloc-brk-mmap",
    "word_count": 4763,
    "reading_time": 11,
    "summary": "malloc 底层通过 brk 或 mmap 实现，但没有说明 brk 一次扩展多少。",
    "prerequisite": "",
    "source_path": "内存管理/malloc(1) 背后的 brk 与 mmap.md"
  },
  {
    "title": "Linux CFS 完全公平调度器（Completely Fair Scheduler）深度拆解",
    "date": "2026-07-09",
    "category": "操作系统",
    "tags": [
      "Linux",
      "CFS",
      "进程调度"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/162712345",
    "slug": "linux-cfs",
    "word_count": 5338,
    "reading_time": 12,
    "summary": "在讲 CFS 之前，先理解所有调度器都在解决同一个核心矛盾：",
    "prerequisite": "了解进程和线程基本概念即可",
    "source_path": "进程调度/Linux CFS 完全公平调度器深度拆解.md"
  },
  {
    "title": "g++ 从入门到忘记",
    "date": "2026-07-07 01:30:44",
    "category": "编译器工具链",
    "tags": [
      "C++",
      "GCC",
      "编译链接"
    ],
    "csdn_url": "https://blog.csdn.net/rr666888/article/details/162645027",
    "slug": "gcc-from-zero",
    "word_count": 2667,
    "reading_time": 6,
    "summary": "习惯用vscode的运行键一键编译，当接触我的第一个项目时，发现怎么能把多个文件合到一块运行。gcc刚好帮我解决了这个问题........",
    "prerequisite": "",
    "source_path": "编译器工具链/GCC编译器完全上手指南.md"
  }
];
