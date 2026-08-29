// 静态首页（home 态设计稿 docs/ux/home.html）：免登录入口卡。
// 用户已下载安装、知道这是什么的——不做产品介绍，只给登录/建号入口。
import { Link } from "react-router-dom";
import { Ico, P } from "@/components/icons";

/** `/` 未登录态渲染；已登录由 App.tsx 的 HomeGate 直接跳书架。 */
export default function LandingPage() {
  return (
    <section className="welcome">
      <div className="mark">
        <span className="mono">爱</span>
      </div>
      <h2>
        人铸灵魂
        <br />
        AI 行笔墨
      </h2>
      <p className="lead">作品与 API Key 只保存在这台电脑上。</p>
      <div className="cta">
        <Link to="/login" className="btn btn-primary">
          免费开始
          <Ico d={P.arrowRight} size={15} />
        </Link>
        <Link to="/login" className="btn btn-secondary">
          我已有账号
        </Link>
      </div>
      <p className="note">
        免费版可创建 <span className="num">3</span> 部作品 · 无需绑卡
      </p>
    </section>
  );
}
