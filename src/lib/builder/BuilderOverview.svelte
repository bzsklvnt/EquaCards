<script lang="ts">
	import type { Issue, BuilderRound } from './issues';
	import { effectiveReading, suit, TYPE_SHORT, type Draft } from './model';

	// Áttekintés: az egész este körönként egy sávban, húzással vagy
	// Alt+←/→ (körök között Alt+↑/↓) átrendezhető; jobb oldalt az ellenőrzés.
	let {
		rounds,
		drafts,
		issues,
		themes,
		selected,
		readingDefault,
		showsStandings,
		busy = false,
		onselect,
		onopen,
		onmove,
		ondrawall
	}: {
		rounds: BuilderRound[];
		drafts: Record<string, Draft>;
		issues: Issue[];
		themes: { id: string; title: string }[];
		selected: { roundId: string; key: string } | null;
		readingDefault: number;
		showsStandings: (roundId: string, key: string) => boolean;
		busy?: boolean;
		onselect: (roundId: string, key: string) => void;
		onopen: (roundId: string, key: string) => void;
		onmove: (fromRoundId: string, key: string, toRoundId: string, toIndex: number) => void;
		ondrawall: (themeId: string, count: number) => void;
	} = $props();

	const REVEAL_OVERHEAD = 20;

	function roundMinutes(round: BuilderRound): number {
		const seconds = round.keys.reduce((sum, key) => {
			const d = drafts[key];
			return d
				? sum + d.time_limit_seconds + effectiveReading(d, readingDefault) + REVEAL_OVERHEAD
				: sum;
		}, 0);
		return Math.round(seconds / 60);
	}

	const totalQuestions = $derived(rounds.reduce((n, r) => n + r.keys.length, 0));
	const totalMinutes = $derived(rounds.reduce((n, r) => n + roundMinutes(r), 0));
	const errors = $derived(issues.filter((i) => i.level === 'error'));
	const flagFor = (roundId: string, key: string) => {
		const own = issues.filter((i) => i.roundId === roundId && i.key === key);
		if (own.some((i) => i.level === 'error')) return 'error';
		if (own.length > 0) return 'warn';
		return null;
	};

	let drag = $state<{ roundId: string; key: string } | null>(null);

	function dropOn(roundId: string, index: number) {
		if (!drag) return;
		onmove(drag.roundId, drag.key, roundId, index);
		drag = null;
	}

	function onCardKeydown(e: KeyboardEvent, ri: number, qi: number) {
		const round = rounds[ri];
		const key = round.keys[qi];
		if (e.key === 'Enter') {
			e.preventDefault();
			onopen(round.id, key);
			return;
		}
		if (!e.altKey) {
			const moves: Record<string, [number, number]> = {
				ArrowLeft: [0, -1],
				ArrowRight: [0, 1],
				ArrowUp: [-1, 0],
				ArrowDown: [1, 0]
			};
			const m = moves[e.key];
			if (!m) return;
			e.preventDefault();
			const nr = Math.min(rounds.length - 1, Math.max(0, ri + m[0]));
			const target = rounds[nr];
			const nq = Math.min(target.keys.length - 1, Math.max(0, m[0] === 0 ? qi + m[1] : qi));
			if (target.keys[nq]) {
				onselect(target.id, target.keys[nq]);
				queueMicrotask(() =>
					document.getElementById(`ov-${target.id}-${target.keys[nq]}`)?.focus()
				);
			}
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		if (e.key === 'ArrowLeft' && qi > 0) onmove(round.id, key, round.id, qi - 1);
		else if (e.key === 'ArrowRight' && qi < round.keys.length - 1)
			onmove(round.id, key, round.id, qi + 1);
		else if (e.key === 'ArrowUp' && ri > 0) {
			onmove(round.id, key, rounds[ri - 1].id, rounds[ri - 1].keys.length);
		} else if (e.key === 'ArrowDown' && ri < rounds.length - 1) {
			onmove(round.id, key, rounds[ri + 1].id, rounds[ri + 1].keys.length);
		} else return;
		queueMicrotask(() => document.getElementById(`ov-${selected?.roundId}-${key}`)?.focus());
	}

	let drawTheme = $state('');
	let drawCount = $state(8);

	export function focusIssue(index: number) {
		const issue = issues[index];
		if (!issue) return;
		if (issue.key) {
			onselect(issue.roundId, issue.key);
			queueMicrotask(() => document.getElementById(`ov-${issue.roundId}-${issue.key}`)?.focus());
		}
	}
</script>

<div class="overview">
	<div class="lanes">
		<div class="summary">
			<span
				>{rounds.length} kör · {totalQuestions} kérdés · <strong>~{totalMinutes} perc</strong></span
			>
			<form
				class="draw-all"
				onsubmit={(e) => {
					e.preventDefault();
					if (drawTheme) ondrawall(drawTheme, drawCount);
				}}
			>
				<select bind:value={drawTheme} aria-label="Téma a random töltéshez" required>
					<option value="">Téma…</option>
					{#each themes as theme (theme.id)}
						<option value={theme.id}>{theme.title}</option>
					{/each}
				</select>
				<input
					type="number"
					min="1"
					max="40"
					bind:value={drawCount}
					aria-label="Kérdés körönként"
				/>
				<button type="submit" disabled={!drawTheme || busy}>Random töltés minden körbe</button>
			</form>
		</div>

		{#each rounds as round, ri (round.id)}
			<section class="lane" aria-label="{ri + 1}. kör · {round.title}">
				<div class="lane-head">
					<strong>{ri + 1}. kör · {round.title}</strong>
					<span>{round.keys.length} kérdés · ~{roundMinutes(round)} perc</span>
				</div>
				<div
					class="cards"
					role="group"
					aria-label="{ri + 1}. kör kérdései"
					ondragover={(e) => e.preventDefault()}
					ondrop={() => dropOn(round.id, round.keys.length)}
				>
					{#each round.keys as key, qi (key)}
						{@const d = drafts[key]}
						{@const flag = flagFor(round.id, key)}
						<div
							id="ov-{round.id}-{key}"
							class="card"
							class:selected={selected?.roundId === round.id && selected?.key === key}
							class:error={flag === 'error'}
							class:warn={flag === 'warn'}
							role="button"
							aria-roledescription="kérdéskártya"
							tabindex="0"
							draggable="true"
							ondragstart={() => (drag = { roundId: round.id, key })}
							ondragover={(e) => e.preventDefault()}
							ondrop={(e) => {
								e.stopPropagation();
								dropOn(round.id, qi);
							}}
							onclick={() => onselect(round.id, key)}
							ondblclick={() => onopen(round.id, key)}
							onkeydown={(e) => onCardKeydown(e, ri, qi)}
							onfocus={() => onselect(round.id, key)}
						>
							<div class="card-top">
								<span>{qi + 1}.</span>
								<span class="flag"
									>{flag === 'error'
										? '!'
										: flag === 'warn'
											? '?'
											: showsStandings(round.id, key)
												? '●'
												: ''}</span
								>
							</div>
							<span class="prompt">{d?.prompt || '— üres —'}</span>
							<div class="suits" aria-hidden="true">
								{#each [0, 1, 2, 3] as i (i)}<span style="background: {suit(i).color}"
									></span>{/each}
							</div>
							<span class="meta"
								>{TYPE_SHORT[d?.type_code ?? ''] ?? ''} · {d?.time_limit_seconds} mp</span
							>
						</div>
					{/each}
					<div class="round-end" aria-hidden="true">Kör vége<br />Top 3</div>
				</div>
			</section>
		{/each}
		<p class="legend">
			● állás a kérdés után · húzás vagy <kbd>Alt ←/→</kbd> átrendezés, <kbd>Alt ↑/↓</kbd> másik
			körbe ·
			<kbd>Enter</kbd> megnyitja a szerkesztőben
		</p>
	</div>

	<aside class="checks" aria-label="Ellenőrzés indulás előtt" data-tour="qb-checks">
		<h3>Ellenőrzés indulás előtt</h3>
		<div class="issues">
			{#each issues as issue, i (i)}
				<button
					type="button"
					class="issue {issue.level}"
					disabled={!issue.key}
					onclick={() => focusIssue(i)}
				>
					<span class="mark">{issue.level === 'error' ? '!' : '?'}</span>
					<span>{issue.text}</span>
				</button>
			{:else}
				<p class="issue ok"><span class="mark">✓</span> Minden rendben, indulhat az este.</p>
			{/each}
		</div>
		<p class="dim">
			{errors.length > 0
				? `${errors.length} hiba javítandó az élő indítás előtt.`
				: 'Nincs blokkoló hiba.'}
			<kbd>F8</kbd> a következőre ugrik.
		</p>
	</aside>
</div>

<style>
	.overview {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20rem;
		min-height: 0;
		height: 100%;
	}

	.lanes {
		min-width: 0;
		overflow-y: auto;
		padding: 1.2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		font-size: 0.9rem;
		color: var(--marquee-dim);
	}

	.draw-all {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.draw-all select,
	.draw-all input,
	.draw-all button {
		height: 2.3rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		padding: 0 0.6rem;
		font: inherit;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.draw-all input {
		width: 4rem;
	}

	.draw-all button {
		font-weight: 600;
		cursor: pointer;
	}

	.draw-all button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.lane {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.lane-head {
		display: flex;
		gap: 0.8rem;
		align-items: baseline;
		font-size: 0.92rem;
	}

	.lane-head span {
		color: var(--marquee-dim);
		font-size: 0.82rem;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-height: 6.5rem;
		padding: 0.25rem;
		border-radius: 0.8rem;
	}

	.card {
		width: 7rem;
		height: 6.5rem;
		box-sizing: border-box;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.65rem;
		background: var(--cabinet-2);
		cursor: grab;
	}

	.card.selected {
		border: 2px solid var(--cyan);
	}

	.card.warn {
		border: 2px solid #c98a2e;
	}

	.card.error {
		border: 2px solid var(--danger);
	}

	.card:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--marquee-dim);
	}

	.card.error .flag {
		color: var(--danger);
	}

	.card.warn .flag {
		color: var(--coin);
	}

	.flag {
		color: var(--cyan);
	}

	.prompt {
		font-size: 0.74rem;
		font-weight: 600;
		line-height: 1.25;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
	}

	.suits {
		margin-top: auto;
		display: flex;
		gap: 3px;
	}

	.suits span {
		flex: 1;
		height: 5px;
		border-radius: 2px;
	}

	.meta {
		font-size: 0.68rem;
		color: var(--marquee-dim);
	}

	.round-end {
		width: 5.5rem;
		height: 6.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		border: 1px dashed var(--field-border, #c9bfa9);
		border-radius: 0.65rem;
		font-size: 0.74rem;
		color: var(--marquee-dim);
	}

	.legend,
	.dim {
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	kbd {
		font-family: ui-monospace, monospace;
	}

	.checks {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.2rem;
		border-left: 1px solid var(--panel-border, #e4ded2);
		background: var(--cabinet-2);
		overflow-y: auto;
	}

	h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.issues {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.issue {
		display: flex;
		gap: 0.6rem;
		margin: 0;
		padding: 0.65rem 0.75rem;
		border: 0;
		border-radius: 0.6rem;
		font: inherit;
		font-size: 0.86rem;
		line-height: 1.35;
		text-align: left;
		color: var(--marquee);
		cursor: pointer;
	}

	.issue:disabled {
		cursor: default;
	}

	.issue.error {
		background: color-mix(in srgb, var(--danger) 12%, var(--cabinet-2));
	}

	.issue.warn {
		background: color-mix(in srgb, var(--coin) 12%, var(--cabinet-2));
	}

	.issue.ok {
		background: color-mix(in srgb, var(--power) 12%, var(--cabinet-2));
	}

	.mark {
		font-weight: 800;
	}

	.issue.error .mark {
		color: var(--danger);
	}

	.issue.warn .mark {
		color: var(--coin);
	}

	.issue.ok .mark {
		color: var(--power);
	}

	@media (max-width: 900px) {
		.overview {
			grid-template-columns: minmax(0, 1fr);
		}

		.checks {
			border-left: 0;
			border-top: 1px solid var(--panel-border, #e4ded2);
		}
	}
</style>
