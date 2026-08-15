import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

function CombatDuMoment() {
  const [combat, setCombat] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  const fetchActiveCombat = useCallback(async () => {
    const { data } = await supabase
      .from('combats')
      .select(`
        id, comic_a_id, comic_b_id, started_at,
        comic_a:comics!combats_comic_a_id_fkey(id, nom, photo_url, slug),
        comic_b:comics!combats_comic_b_id_fkey(id, nom, photo_url, slug)
      `)
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      const { count: countA } = await supabase
        .from('match_votes')
        .select('*', { count: 'exact', head: true })
        .eq('combat_id', data.id)
        .eq('winner_id', data.comic_a_id);

      const { count: countB } = await supabase
        .from('match_votes')
        .select('*', { count: 'exact', head: true })
        .eq('combat_id', data.id)
        .eq('winner_id', data.comic_b_id);

      setCombat({ ...data, votesA: countA || 0, votesB: countB || 0 });
    } else {
      setCombat(null);
    }
  }, []);

  const fetchLastResult = useCallback(async () => {
    const { data } = await supabase
      .from('combats')
      .select(`
        id, ended_at, winner_id, votes_a, votes_b,
        comic_a:comics!combats_comic_a_id_fkey(id, nom, photo_url, slug),
        comic_b:comics!combats_comic_b_id_fkey(id, nom, photo_url, slug),
        winner:comics!combats_winner_id_fkey(id, nom, photo_url, slug)
      `)
      .eq('is_active', false)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setLastResult(data);
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from('combats')
      .select(`
        id, started_at, ended_at, votes_a, votes_b,
        comic_a:comics!combats_comic_a_id_fkey(id, nom, photo_url, slug),
        comic_b:comics!combats_comic_b_id_fkey(id, nom, photo_url, slug),
        winner:comics!combats_winner_id_fkey(id, nom, photo_url, slug)
      `)
      .eq('is_active', false)
      .order('ended_at', { ascending: false });

    setHistory(data || []);
  }, []);

  useEffect(() => {
    fetchActiveCombat();
    fetchLastResult();

    const key = combat ? `combat_vote_${combat.id}` : null;
    if (key) setHasVoted(!!localStorage.getItem(key));
  }, [fetchActiveCombat, fetchLastResult, combat?.id]);

  const vote = async (winnerId) => {
    if (!combat || hasVoted || voting) return;
    setVoting(true);

    await supabase.from('match_votes').insert({
      comic_a_id: combat.comic_a_id,
      comic_b_id: combat.comic_b_id,
      winner_id: winnerId,
      combat_id: combat.id
    });

    localStorage.setItem(`combat_vote_${combat.id}`, '1');
    setHasVoted(true);
    await fetchActiveCombat();
    setVoting(false);
  };

  const openHistory = async () => {
    await fetchHistory();
    setShowHistory(true);
  };

  const totalVotes = combat ? combat.votesA + combat.votesB : 0;
  const pctA = totalVotes > 0 ? Math.round((combat.votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <section className="w-full max-w-4xl mx-auto my-10 px-4">
      <h2 className="text-2xl font-bold text-center mb-1 flex items-center justify-center gap-2">
        ⚔️ Combat du moment
      </h2>
      <p className="text-center text-sm text-gray-400 mb-6">
        Un affrontement spécial, choisi par la rédaction — votez jusqu'à la clôture du combat.
      </p>

      {combat ? (
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          {[
            { data: combat.comic_a, id: combat.comic_a_id, votes: combat.votesA, pct: pctA },
            { data: combat.comic_b, id: combat.comic_b_id, votes: combat.votesB, pct: pctB }
          ].map((side, i) => (
            <button
              key={side.id}
              onClick={() => vote(side.id)}
              disabled={hasVoted || voting}
              className={`relative overflow-hidden rounded-2xl border-2 transition-all
                ${hasVoted ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02] hover:border-orange-500'}
                border-gray-700 bg-gray-900`}
            >
              <img
                src={side.data?.photo_url}
                alt={side.data?.nom}
                className="w-full h-48 md:h-64 object-cover"
              />
              <div className="p-3 text-center">
                <p className="font-bold text-lg">{side.data?.nom}</p>
                {hasVoted && (
                  <>
                    <div className="w-full h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full ${i === 0 ? 'bg-orange-500' : 'bg-pink-500'}`}
                        style={{ width: `${side.pct}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{side.votes} votes ({side.pct}%)</p>
                  </>
                )}
              </div>
              {i === 0 && (
                <span className="absolute top-2 left-1/2 -translate-x-1/2 translate-y-[-50%] md:hidden text-2xl">VS</span>
              )}
            </button>
          ))}
          <span className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-black text-orange-500 z-10">
            VS
          </span>
        </div>
      ) : (
        <p className="text-center text-gray-500 italic">Aucun combat en cours pour le moment.</p>
      )}

      {/* Carré résultat — toujours visible */}
      {lastResult && (
        <div
          onClick={openHistory}
          className="mt-6 p-4 rounded-xl bg-gray-900 border border-gray-700 cursor-pointer hover:border-orange-500 transition-colors"
        >
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2 text-center">
            Dernier combat — cliquez pour voir l'historique complet
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <img src={lastResult.comic_a.photo_url} className="w-14 h-14 rounded-full object-cover mx-auto" alt="" />
              <p className="text-sm mt-1">{lastResult.comic_a.nom}</p>
              <p className="text-xs text-gray-500">{lastResult.votes_a} votes</p>
            </div>
            <div className="text-center px-2">
              <span className="text-2xl">🏆</span>
              <p className="text-sm font-bold text-orange-400">{lastResult.winner?.nom}</p>
            </div>
            <div className="text-center">
              <img src={lastResult.comic_b.photo_url} className="w-14 h-14 rounded-full object-cover mx-auto" alt="" />
              <p className="text-sm mt-1">{lastResult.comic_b.nom}</p>
              <p className="text-xs text-gray-500">{lastResult.votes_b} votes</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal historique */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">📜 Historique des combats</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              {history.map((c) => {
                const total = c.votes_a + c.votes_b;
                const pA = total > 0 ? Math.round((c.votes_a / total) * 100) : 50;
                return (
                  <div key={c.id} className="p-3 rounded-xl bg-gray-800 border border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">
                      {new Date(c.ended_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-3">
                      <img src={c.comic_a.photo_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className={c.winner?.id === c.comic_a.id ? 'font-bold text-orange-400' : ''}>{c.comic_a.nom}</span>
                          <span className={c.winner?.id === c.comic_b.id ? 'font-bold text-orange-400' : ''}>{c.comic_b.nom}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden flex">
                          <div className="h-full bg-orange-500" style={{ width: `${pA}%` }} />
                          <div className="h-full bg-pink-500" style={{ width: `${100 - pA}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{c.votes_a} votes</span>
                          <span>{c.votes_b} votes</span>
                        </div>
                      </div>
                      <img src={c.comic_b.photo_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                    </div>
                  </div>
                );
              })}
              {history.length === 0 && (
                <p className="text-center text-gray-500 italic py-8">Aucun combat clôturé pour l'instant.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CombatDuMoment;
