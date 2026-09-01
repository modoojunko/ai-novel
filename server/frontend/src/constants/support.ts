/**
 * 客服联系单一事实源：邮箱与时限承诺数字与 docs/legal 四件套逐字一致
 * （付费须知 §十一 = 48 小时一般回复；隐私政策 §四 = 15 个工作日个保权利响应）。
 * 协议改版须同批修改此处；客服邮箱另硬编码在 public/legal 三页、docs/legal 四件套、
 * README/README.zh 商务咨询行、docs/design-s 设计稿与原型、e2e support.spec.ts，
 * 换邮箱须同批全改（含 design-s 与 README，缺一处即口径漂移）。
 */
export const SUPPORT_EMAIL = 'support@xingweitouzi.cn'

/** 一般客服咨询的回复时限（小时），口径=付费须知 §十一（退款申诉/处置申诉同此口径） */
export const SUPPORT_REPLY_HOURS = 48

/** 个人信息权利行使的响应时限（工作日），口径=隐私政策 §四 */
export const PRIVACY_RESPONSE_WORKDAYS = 15

/** 账号注销办理时限（工作日），口径=用户服务协议 §三.4（与个保同值但是独立承诺，改协议须分别核对） */
export const ACCOUNT_DELETION_WORKDAYS = 15

/** 电子普通发票出具时限（工作日），口径=付费须知 §八 */
export const INVOICE_WORKDAYS = 3
