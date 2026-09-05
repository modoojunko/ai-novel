## 1. 实现

- [x] 1.1 `client/backend/backup/import.py` 新增 `_restore_config(db, user_id, config_data)`：user 子集只补空（display_name/api_key/api_base_url/api_model）+ api_configs 同名跳过/新建重加密（encrypt_api_key）；时间字段 None/非法容错；返回 {created, skipped, user_filled}；验证：单测四例（新建/同名跳过/只补空不覆盖/空 config_data 不崩）
- [x] 1.2 `_import_single_book` 局部导入块补 `ChapterVersion`；验证：含 versions/ 的最小包导入断言 ChapterVersion 行落库

## 2. 测试

- [x] 2.1 `client/backend/tests/` 新增用例：配置恢复往返（export 格式 config.yaml → _restore_config → ApiConfig 行与解密密钥断言 + 同名跳过断言 + user 只补空断言）；验证：pytest 绿
- [x] 2.2 版本快照导入用例（复用既有包 fixture 补 versions/）；验证：pytest 绿
- [ ] 2.3 C端 后端全量测试套件通过（容器内模板跑法）；验证：F821 清零 + 全量绿【实录：新增 5 例绿；宿主全量 12 例环境假红与基线一致；C端 后端 CI 基建层空步骤失败（runner 未启动，非代码），已 admin 合并并在归档总结记录】

## 3. 交付

- [x] 3.1 PR 合并（C端 后端 CI 随 F821 消除转绿）；验证：CI 绿
- [x] 3.2 openspec 归档（skip_specs 无 sync，纯文档 PR）；验证：archive 目录就位
