import mascotUrl from "../../assets/xiaoelong-mascot.png";
import "../../styles/pet-release.css";

const VERSION = "2.2.3";
const WINDOWS_DOWNLOAD = `https://github.com/sheephjc/XiaoELong/releases/download/v${VERSION}/XiaoELong.Setup.${VERSION}.exe`;
const MAC_DOWNLOAD = `https://github.com/sheephjc/XiaoELong/releases/download/v${VERSION}/XiaoELong-${VERSION}-mac-universal.dmg`;

export function PetReleasePage(): JSX.Element {
  return (
    <main className="pet-release">
      <header className="pet-release__nav">
        <a className="pet-release__brand" href="/pet" aria-label="小鳄龙桌面组件发布页">
          <span className="pet-release__brand-mark">鳄</span>
          <span>小鳄龙桌面组件</span>
        </a>
        <a className="pet-release__github" href="https://github.com/sheephjc/XiaoELong" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>

      <section className="pet-release__hero">
        <div className="pet-release__copy">
          <span className="pet-release__eyebrow">XIAOELONG DESKTOP · v{VERSION}</span>
          <h1>把小鳄龙，<br />放在你的桌面上。</h1>
          <p className="pet-release__lead">
            一只常驻桌面的轻量小伙伴，也是属于朋友们的聊天空间。随时打开面板，聊天、做每日一题、下五子棋，看看今天谁又登上了神位。
          </p>
          <div className="pet-release__downloads" aria-label="客户端下载">
            <a className="pet-download pet-download--primary" href={WINDOWS_DOWNLOAD}>
              <span className="pet-download__icon">⊞</span>
              <span><strong>Windows 版</strong><small>Windows 10 / 11 · 64 位</small></span>
            </a>
            <a className="pet-download" href={MAC_DOWNLOAD}>
              <span className="pet-download__icon">⌘</span>
              <span><strong>macOS 版</strong><small>Intel 与 Apple 芯片通用</small></span>
            </a>
          </div>
          <p className="pet-release__version">当前版本 {VERSION} · 2026 年 9 月 22 日</p>
        </div>

        <div className="pet-release__visual" aria-label="小鳄龙桌面组件预览">
          <div className="pet-release__halo" />
          <div className="pet-release__bubble pet-release__bubble--chat">今晚谁在线？</div>
          <div className="pet-release__bubble pet-release__bubble--mood">今日心情：元气满满</div>
          <img src={mascotUrl} alt="小鳄龙" />
          <div className="pet-release__platforms"><span>Windows</span><span>macOS</span></div>
        </div>
      </section>

      <section className="pet-release__features" aria-labelledby="features-title">
        <div className="pet-release__section-heading">
          <span>不只是一只桌宠</span>
          <h2 id="features-title">朋友们的小小桌面基地</h2>
        </div>
        <div className="pet-release__feature-grid">
          <article><i>01</i><h3>随手聊两句</h3><p>文字、图片和附件都能分享，消息提醒不会打断手头的事情。</p></article>
          <article><i>02</i><h3>每天一点新鲜感</h3><p>每日一题、今日心情和生日惊喜，让每次打开面板都有点不同。</p></article>
          <article><i>03</i><h3>一起玩一局</h3><p>邀请在线好友来一盘五子棋，也可以看看今日神位花落谁家。</p></article>
        </div>
      </section>

      <section className="pet-release__release">
        <div><span className="pet-release__eyebrow">WHAT'S NEW</span><h2>2.2.3 更新</h2></div>
        <ul>
          <li>新增 Windows 与 macOS 客户端发布页。</li>
          <li>托盘打开程序时直接进入左键主面板。</li>
          <li>升级服务端与构建依赖，修复已知安全告警。</li>
          <li>新增 xiaoelong.cn/pet 发布页，桌面服务继续使用现有服务器 IP。</li>
        </ul>
      </section>

      <footer className="pet-release__footer">
        <span>© 2026 小鳄龙之家</span>
        <span>在桌面上，和朋友们待在一起。</span>
      </footer>
    </main>
  );
}
