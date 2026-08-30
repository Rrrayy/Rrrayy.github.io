window.blog_articles=[
	{date:'2026-08-15',title:'lambda 闭包原理',category:'C++ 新特性',reading_time:6,slug:'lambda-closure',summary:'在写代码时经常要给 std::sort 传比较器，本文从编译器视角拆解 lambda 的匿名类、捕获成员与生命周期。'},
	{date:'2026-07-27',title:'零拷贝到底快在哪？',category:'IO 模型',reading_time:5,slug:'zero-copy',summary:'通过 sendfile 与 read+write 的对照实验，分析数据路径、系统调用次数和用户态拷贝成本。'},
	{date:'2026-07-21',title:'锁的进阶：从自旋锁到手写实现，再到死锁与条件变量',category:'并发编程',reading_time:9,slug:'locks-and-condition-variables',summary:'从自旋锁原理到死锁定位，再到条件变量生产者消费者模型，完整记录实验过程和数据。'},
	{date:'2026-07-17',title:'C++ 多线程入门：创建线程、加锁、计数',category:'并发编程',reading_time:6,slug:'cpp-threads',summary:'从线程创建和生命周期开始，用实验理解竞态条件、mutex 与 atomic 的取舍。'},
	{date:'2026-07-14',title:'ext4文件系统详解：用dd和mkfs.ext4从零解剖',category:'文件系统',reading_time:9,slug:'ext4-layout',summary:'用 dd、mkfs.ext4 和 hexdump 观察超级块、位图、inode 与数据块的真实布局。'},
	{date:'2026-07-13',title:'硬链接和软链接的区别--inode 详解',category:'文件系统',reading_time:9,slug:'inode-links',summary:'从 stat、ln、unlink 和 strace 出发，验证文件名、inode、硬链接与软链接的关系。'},
	{date:'2026-07-11',title:'malloc(1) 背后的 brk 与 mmap',category:'内存管理',reading_time:11,slug:'malloc-brk-mmap',summary:'从一次 malloc(1) 实验追踪 glibc 的 brk、mmap、top chunk 与释放路径。'},
	{date:'2026-07-09',title:'Linux CFS 完全公平调度器（Completely Fair Scheduler）深度拆解',category:'操作系统',reading_time:12,slug:'linux-cfs',summary:'从调度器要解决的矛盾出发，拆解 vruntime、nice 权重、红黑树、调度延迟和上下文切换。'},
	{date:'2026-07-07 01:30:44',title:'g++ 从入门到忘记',category:'编译器工具链',reading_time:6,slug:'gcc-from-zero',summary:'从 gcc 与 g++ 的区别开始，逐步拆开预处理、编译、汇编、链接和多文件构建。'}
];
