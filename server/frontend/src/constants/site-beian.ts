/**
 * 备案信息单一事实源：值全部来自构建期环境变量注入（GitHub Secrets → 内联展开），
 * 源码与仓库零硬编码；换号只需更新 secret 重新发布。
 * 省份口径由运维填入对应格式号码承担（广东主体备案「粤ICP备×号」/ 其他省服务备案号）。
 */
const icp = String(import.meta.env.VITE_BEIAN_ICP ?? '').trim()
const police = String(import.meta.env.VITE_BEIAN_POLICE ?? '').trim()
const policeLink = String(import.meta.env.VITE_BEIAN_POLICE_LINK ?? '').trim()

export const siteBeian = {
  icp,
  police,
  miitUrl: 'https://beian.miit.gov.cn/',
  // 公安备案查询页：未显式配置链接时按编号中的数字串拼默认查询地址
  policeUrl: policeLink || (police ? `https://beian.mps.gov.cn/#/query/webSearch?code=${police.replace(/\D/g, '')}` : ''),
}

export const hasBeianInfo = Boolean(siteBeian.icp || siteBeian.police)
