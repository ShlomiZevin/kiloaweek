import type { Body } from '../lib/body';
import type { Profile } from '../lib/types';

const f = (n: number) => n.toLocaleString('he-IL');
const r50 = (x: number) => Math.round(x / 50) * 50;

/** How the daily target is worked out, step by step (his rule: the target means nothing without its reasoning).
 *  Built to the GPT Image mockups design/r3/target-body.png + target-home.png; the step pictures are design/r3/why-icons.png. */
export function TargetSteps({ body, sex }: { body: Body; sex?: Profile['sex'] }) {
  const lo = r50(body.tdee - 1100), hi = r50(body.tdee - 770);
  const who = sex === 'f' ? 'לאישה' : 'לגבר';
  return (
    <ol className="why-steps">
      <li>
        <img src="/img/why-flame.png" alt="" />
        <div><span>ביום רגיל הגוף שלך שורף בערך</span><b><span className="num">{f(body.tdee)}</span> קלוריות</b></div>
      </li>
      <li>
        <img src="/img/why-plate.png" alt="" />
        <div><span>כדי לרדת 700 גרם עד קילו בשבוע - אוכלים <span className="num">770</span> עד <span className="num">1,100</span> פחות ביום</span><em><span className="num">{f(Math.max(0, lo))}–{f(hi)}</span> קלוריות</em></div>
      </li>
      <li>
        <img src="/img/why-shield.png" alt="" />
        <div>{body.floored
          ? <><span>אבל {who} לא מומלץ לרדת מתחת ל-</span><b><span className="num">{f(body.floor)}</span> קלוריות ביום</b></>
          : <><span>וזה מעל המינימום הבטוח {who}</span><b><span className="num">{f(body.floor)}</span> קלוריות ביום</b></>}</div>
      </li>
      <li className="last">
        <img src="/img/why-shoe.png" alt="" />
        <div><span>לכן היעד שלך</span><b className="big"><span className="num">{f(body.target)}</span> קלוריות ביום</b>
          <span>{body.floored ? 'ואת השאר של הגירעון משלימה התנועה - הליכה, אימון.' : 'באמצע הטווח. תנועה (הליכה, אימון) מורידה עוד יותר.'}</span></div>
      </li>
    </ol>
  );
}
