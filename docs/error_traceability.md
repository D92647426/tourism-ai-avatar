# Java 基线运行问题记录

## ERR-027-001 Windows 检查结束时临时日志被占用

触发：通过 Oracle javapath 的 java 代理运行 JAR 后，只终止父进程会遗留实际 JVM 子进程，导致临时 server.log 无法删除。

修复：[smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1) 在 Windows 退出时停止自己创建的进程树，在其他系统终止自身进程；不按端口结束任意进程。

已重新执行同一检查，验证通过，测试 Java 进程正常退出。
