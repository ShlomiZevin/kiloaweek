import { useState } from 'react';
import { useStore } from '../lib/store';
import { PageHead } from '../App';
import { Icon } from '../ui';
import { useAgain } from './Food';
import { Macros } from './Coach';

/** The meal library: every meal she logged (from Food or from the coach), kept once by name, to eat again in one tap. */
export function Foods() {
  const { foods, forgetMeal } = useStore();
  const again = useAgain();
  const [q, setQ] = useState('');
  const list = foods.filter(f => !q.trim() || f.he.includes(q.trim()));
  return (
    <div className="stack">
      <PageHead title="הארוחות השמורות שלי" sub="כל ארוחה שתיעדת נשמרת כאן. לחיצה מוסיפה אותה להיום." />
      {foods.length > 5 && <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש" />}
      {list.length ? list.map(f => (
        <div key={f.id} className="card meal">
          <button className="meal-add" onClick={() => again(f)}>
            {f.thumb ? <img className="ph" src={f.thumb} alt="" /> : <span className="ph"><img src="/img/f-bowl.png" alt="" /></span>}
            <div className="mi"><b>{f.he}</b><Macros m={f} /><span className="hint">{f.n > 1 ? `נאכלה ${f.n} פעמים` : 'נאכלה פעם אחת'}</span></div>
            <span className="plus"><Icon name="plus" size={20} stroke={2.6} /></span>
          </button>
          <button className="icon-btn sm" onClick={() => forgetMeal(f.id)} aria-label={`הסרת ${f.he} מהשמורות`}><Icon name="trash" size={18} /></button>
        </div>
      )) : <p className="hint empty-line">{foods.length ? 'לא נמצאה ארוחה כזאת.' : 'עוד אין ארוחות שמורות. כל ארוחה שתתעדו - באוכל או בצ׳אט עם המאמנת - תישמר כאן.'}</p>}
    </div>
  );
}
