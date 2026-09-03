# devices Specification

## Purpose
web 控制台设备管理（我的设备列表与解绑）的路由契约：资源名对齐复数 devices，与 client 面设备路由（/api/devices/current）同一对象同一数。

## Requirements

### Requirement: 设备路由复数命名对齐

web 控制台设备路由 SHALL 使用复数资源名 devices（`GET /api/devices/my`、`POST /api/devices/remove`），与 client 面既有设备路由的单复数口径一致；请求/响应体与未登录口径（code=1）保持不变。方法与参数形态维持 POST+body（不做 RESTful DELETE 改造，属语义变更不在命名范畴）。

#### Scenario: 设备列表与解绑走 devices 路径

- **WHEN** 已登录用户请求 `GET /api/devices/my` 或 `POST /api/devices/remove`
- **THEN** 行为与原 device/my、device/remove 完全一致（登录态列表/解绑结果、未登录 code=1）

#### Scenario: 旧路径过渡别名

- **WHEN** 客户端仍请求 `GET /api/device/my` 或 `POST /api/device/remove`
- **THEN** 返回与对应新路径完全一致的结果
- **AND** 别名为过渡兼容，前端线上包零引用后 MUST 移除
