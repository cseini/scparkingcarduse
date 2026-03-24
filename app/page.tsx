
import { supabase } from '../lib/supabaseClient';

async function getParkingCards() {
  const { data, error } = await supabase
    .from('parking_cards')
    .select('*');

  if (error) {
    console.error('Error fetching parking cards:', error);
    return [];
  }

  return data;
}

export default async function Home() {
  const parkingCards = await getParkingCards();

  return (
    <div className="container">
      <h1 className="title">SC 제일은행 주차 관리</h1>
      <div className="grid">
        {parkingCards.map((card) => (
          <div key={card.id} className="card">
            <h2>{card.user_name}</h2>
            <p className="remaining">남은 횟수: {card.remaining_uses}</p>
            <form action="/api/update-uses" method="post">
              <input type="hidden" name="id" value={card.id} />
              <button type="submit" className="button">사용</button>
            </form>
          </div>
        ))}
      </div>
      <form action="/api/reset-uses" method="post">
        <button type="submit" className="reset-button">전체 초기화</button>
      </form>
    </div>
  );
}
