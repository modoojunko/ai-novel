# 任务

## 1. 组件拆分

- [x] 1.1 「AI 帮我拆」向导从 StoryArcForm 拆为独立组件（自持 step/input/running/audit 状态；arc 受控读写，产出落卡自动保存与续步行为不变）

## 2. 三栏布局

- [x] 2.1 SettingsView 骨架 two-col → three-col（col-tree / col-middle+col-panel / col-ai），主线面板时右栏挂向导
- [x] 2.2 其他面板右栏内容：world/style/antiAI=AI 说明卡；其余=「暂无 AI 功能」占位；随 panel 切换
- [x] 2.3 多对象设定（角色/伏笔）中间栏内嵌子双栏：对象列表（新增/选择）+ 选中对象配置表单；弹窗表单退役；切换保护沿用既有 confirm 口径
- [x] 2.4 book.css：设定作用域三栏 + 内嵌子双栏 + 窄屏（<1024px）右栏堆叠不隐藏

## 3. 测试

- [x] 3.1 vitest：向导新组件用例迁移 + 表单/向导联动（arc 状态提升）+ 角色/伏笔子双栏（新增/切换/未保存保护）用例
- [x] 3.2 e2e story-arc.spec.ts 向导定位适配右栏；角色/伏笔相关 e2e 用例适配子双栏；本地 docker 栈全量跑
- [x] 3.3 全量回归：vitest / tsc / design-lint / e2e 全绿
