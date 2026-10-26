# Java 基线运行问题记录

## ERR-027-001 Windows 检查结束时临时日志被占用

触发：通过 Oracle javapath 的 java 代理运行 JAR 后，只终止父进程会遗留实际 JVM 子进程，导致临时 server.log 无法删除。

修复：[smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1) 在 Windows 退出时停止自己创建的进程树，在其他系统终止自身进程；不按端口结束任意进程。

已重新执行同一检查，验证通过，测试 Java 进程正常退出。

## ERR-032-001 Windows 预览进程占用待重新打包的 JAR

触发：`mvn verify` 的 Spring Boot repackage 报 `Unable to rename ...jar to ...jar.original`。本轮是自己启动的预览仍在使用同一 JAR，不是源码编译失败。

处理：根据本次预览记录的 PID 只停止该进程树，再重新执行构建和 [隔离 HTTP 检查 smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，均通过。需在预览同时打包时，先复制 JAR 到独立临时工作目录再启动副本。不要强杀所有 Java 或占用其他服务的端口。
