/** Tablature bend geometry resolved from note/tie semantics; no score-specific rules. */
function configureTabBendLayout(gve: any, vfNote: any): void {
  const modifiers = vfNote.getModifiers().filter((modifier) => modifier.getCategory() === "bends");
  if (gve.notes.length > 1 && modifiers.length === 1) {
    const sources = gve.notes.map((note) => note.sourceNote);
    const first = sources[0].BendArray;
    // A simultaneous chord bend is one gesture, not consecutive bend stages.
    if (first?.length === 1 && first[0].direction === "up" && !first[0].preBend && first[0].bendalter > 0 &&
        sources.every((note) => note.BendArray?.length === 1 && note.BendArray[0].direction === "up" &&
          !note.BendArray[0].preBend && note.BendArray[0].bendalter === first[0].bendalter)) {
      const bend = modifiers[0];
      const originalDraw = bend.draw.bind(bend);
      bend.draw = () => {
        const ys = vfNote.getYs();
        const x = vfNote.getModifierStartXY(2, 0).x + 3;
        const peakX = x + 20;
        const top = Math.min(vfNote.getStave().getYForTopText(bend.text_line) + 3, Math.min(...ys) - 25);
        if (ys.length !== sources.length || ![x, peakX, top, ...ys].every(Number.isFinite)) {
          originalDraw();
          return;
        }
        const ctx = bend.context;
        ctx.openGroup?.("tab-chord-bend");
        ctx.save();
        ctx.setStrokeStyle(bend.render_options.line_style);
        ctx.setFillStyle(bend.render_options.line_style);
        ctx.setLineWidth(bend.render_options.line_width);
        for (const y of ys) {
          ctx.beginPath();
          ctx.moveTo(x, y + 0.5);
          ctx.quadraticCurveTo(peakX, y + 0.5, peakX, top);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(peakX, top);
        ctx.lineTo(peakX - 4, top + 5);
        ctx.lineTo(peakX + 4, top + 5);
        ctx.closePath();
        ctx.fill();
        const label = bend.phrase[0].text;
        ctx.setRawFont(bend.font);
        ctx.fillText(label, peakX - ctx.measureText(label).width / 2, top - 4);
        ctx.restore();
        ctx.closeGroup?.();
        bend.setRendered();
      };
    }
    return;
  }
  if (gve.notes.length !== 1 || modifiers.length !== 1) {
    return;
  }
  const bend = modifiers[0];
  const originalDraw = bend.draw.bind(bend);
  bend.draw = () => {
    // Resolve endpoints across barlines, but never connect coordinates from
    // different systems. At a system edge the gesture ends at the stave edge.
    const measure = gve.parentStaffEntry.parentMeasure;
    const entries = (measure.ParentStaffLine?.Measures ?? [measure]).flatMap((bar) => bar.staffEntries)
      .flatMap((entry) => entry.graphicalVoiceEntries)
      .filter((entry) => entry.parentVoiceEntry.ParentVoice === gve.parentVoiceEntry.ParentVoice);
    const noteAt = (entry) => entry?.notes[0]?.vfnote?.[0];
    // Future notes still use temporary stave coordinates. Translate their x
    // position without setStave: resetting a beamed note during a bend's draw
    // invalidates the stem bounds already calculated by VexFlow's formatter.
    const xAt = (entry) => {
      const note = noteAt(entry);
      if (!note) return NaN;
      const bar = entry.parentStaffEntry.parentMeasure;
      const noteStart = bar.PositionAndShape.AbsolutePosition.x * 10 +
        bar.stave.getNoteStartX() - bar.stave.getX();
      return note.getAbsoluteX() + noteStart - note.getStave().getNoteStartX();
    };
    const index = entries.indexOf(gve);
    const source = gve.notes[0].sourceNote;
    const bends = source.BendArray ?? [];
    const pre = bends.find((segment) => segment.preBend && segment.bendalter !== 0);
    const previous = entries[index - 1];
    const previousSource = previous?.notes.length === 1 ? previous.notes[0].sourceNote : undefined;
    const tied = (first, last) => first && last && first.StringNumberTab === last.StringNumberTab &&
      first.FretNumber === last.FretNumber && first.ParentVoiceEntry.ParentVoice === last.ParentVoiceEntry.ParentVoice &&
      [first.NoteTie, last.NoteTie].some((tie) => {
        const i = tie?.Type === "" ? tie.Notes.indexOf(first) : -1;
        return i >= 0 && tie.Notes[i + 1] === last;
      });
    const next = entries[index + 1];
    const nextSource = next?.notes.length === 1 ? next.notes[0].sourceNote : undefined;
    const following = entries.slice(index + 1).find((entry) =>
      !entry.parentVoiceEntry.IsGrace && entry.notes[0]?.vfnote?.[0]?.getTickContext?.());
    const rising = (note) => note?.BendArray?.length === 1 && !note.BendArray[0].preBend &&
      note.BendArray[0].direction === "up" && note.BendArray[0].bendalter > 0;
    // Sustain chains can contain several held pre-bend notes. Their arrival
    // pitch, rather than the immediately preceding gesture's shape, determines
    // whether this is a continuation or a genuinely new pre-bend attack.
    const tieIndex = source.NoteTie?.Type === "" ? source.NoteTie.Notes.indexOf(source) : -1;
    const incomingSource = previousSource ?? (tieIndex > 0 ? source.NoteTie.Notes[tieIndex - 1] : undefined);
    const bendEnd = (note) => (note?.BendArray ?? []).reduce((value, segment) =>
      segment.preBend ? segment.bendalter : value + (segment.direction === "down" ? -1 : 1) * Math.abs(segment.bendalter), 0);
    const continuedPeak = pre && tied(incomingSource, source) &&
      Math.abs(bendEnd(incomingSource) - pre.bendalter) < 1e-8;
    const nextPre = nextSource?.BendArray?.find((segment) => segment.preBend);
    const risesToNextPeak = rising(source) && tied(source, nextSource) && nextPre?.bendalter === bends[0].bendalter;
    const risesFromRelease = rising(source) && tied(incomingSource, source) &&
      incomingSource.BendArray?.some((segment) => segment.direction === "down" && segment.bendalter === bends[0].bendalter);
    if (risesToNextPeak || risesFromRelease) {
      const target = noteAt(following);
      const x = vfNote.getAbsoluteX() + (vfNote.tabFretNumbersSuppressed ? 0 : vfNote.glyph.getWidth() + 3);
      const y = vfNote.getYs()[0] - 3;
      const peakX = risesToNextPeak && target ? xAt(following) + target.glyph.getWidth() / 2
        : target ? xAt(following) - 4 : measure.stave.getNoteEndX() - 4;
      const peakBend = risesToNextPeak ? target?.getModifiers().find((modifier) => modifier.getCategory() === "bends") : bend;
      const top = Math.min(vfNote.getStave().getYForTopText(peakBend?.text_line ?? bend.text_line) + 3, y - 30);
      if (![x, y, peakX, top].every(Number.isFinite) || peakX <= x || top >= y) {
        originalDraw();
        return;
      }
      const ctx = bend.context;
      ctx.openGroup?.("tab-tied-bend-rise");
      ctx.save();
      ctx.setStrokeStyle(bend.render_options.line_style);
      ctx.setFillStyle(bend.render_options.line_style);
      ctx.setLineWidth(bend.render_options.line_width);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(peakX, y, peakX, top);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(peakX, top);
      ctx.lineTo(peakX - 4, top + 5);
      ctx.lineTo(peakX + 4, top + 5);
      ctx.closePath();
      ctx.fill();
      ctx.setRawFont(bend.font);
      const label = bend.phrase[0].text;
      ctx.fillText(label, peakX - ctx.measureText(label).width / 2, top - 4);
      ctx.restore();
      ctx.closeGroup?.();
      bend.setRendered();
      return;
    }
    const tiedPredecessor = previousSource?.BendArray?.length === 1 && previousSource.BendArray[0].preBend &&
      Math.abs(previousSource.BendArray[0].bendalter) === Math.abs(bends[0]?.bendalter) &&
      source.NoteTie && source.NoteTie === previousSource.NoteTie &&
      source.StringNumberTab === previousSource.StringNumberTab && source.FretNumber === previousSource.FretNumber;
    if (!pre && tiedPredecessor && bends.length === 1 && bends[0].direction === "down") {
      return; // The explicitly tied pre-bend draws this release as one phrase.
    }
    const movements = bends.filter((segment) => !segment.preBend && segment.bendalter !== 0);
    if (pre && bends.filter((segment) => segment.preBend).length === 1 && movements.length <= 1 &&
        movements.every((segment) => segment.direction === "down" && Math.abs(segment.bendalter) === Math.abs(pre.bendalter))) {
      const tiedRelease = source.NoteTie && source.NoteTie === nextSource?.NoteTie &&
        source.StringNumberTab === nextSource.StringNumberTab && source.FretNumber === nextSource.FretNumber &&
        nextSource.BendArray?.length === 1 && !nextSource.BendArray[0].preBend && nextSource.BendArray[0].direction === "down" &&
        Math.abs(nextSource.BendArray[0].bendalter) === Math.abs(pre.bendalter)
        ? next : undefined;
      const release = bends.some((segment) => !segment.preBend && segment.bendalter !== 0) ? gve : tiedRelease;
      const releaseNote = noteAt(release);
      const afterRelease = entries.slice(index + (tiedRelease ? 2 : 1)).find((entry) =>
        !entry.parentVoiceEntry.IsGrace && entry.notes[0]?.vfnote?.[0]?.getTickContext?.());
      const x = vfNote.getAbsoluteX() + vfNote.glyph.getWidth() / 2;
      const y = vfNote.getYs()[0] - 3;
      let peakEntry = gve;
      // Every held segment shares the first peak's height on this staff line.
      // Individual modifiers may have different text lanes because of vibrato.
      if (continuedPeak) for (let i = index - 1; i >= 0; i--) {
        const prior = entries[i], after = entries[i + 1];
        if (prior.notes.length !== 1 || !tied(prior.notes[0].sourceNote, after.notes[0].sourceNote) ||
          Math.abs(bendEnd(prior.notes[0].sourceNote) - pre.bendalter) > 1e-8 ||
          !prior.notes[0].sourceNote.BendArray?.some(segment => segment.preBend && segment.bendalter === pre.bendalter)) break;
        peakEntry = prior;
      }
      const peakNote = noteAt(peakEntry) ?? vfNote;
      const peakBend = peakNote.getModifiers().find(modifier => modifier.getCategory() === "bends");
      const top = Math.min(peakNote.getStave().getYForTopText(peakBend?.text_line ?? bend.text_line) + 3, peakNote.getYs()[0] - 33);
      const holdX = releaseNote && release !== gve ? xAt(release) : x;
      const endX = afterRelease ? xAt(afterRelease) - 4 : (release?.parentStaffEntry.parentMeasure ?? measure).stave.getNoteEndX() - 4;
      if (![x, y, top, holdX, endX].every(Number.isFinite) || top >= y || (release && endX <= holdX)) {
        originalDraw();
        return;
      }
      const ctx = bend.context;
      ctx.openGroup?.(continuedPeak && !release ? "tab-bend-hold" : "tab-prebend");
      ctx.save();
      ctx.setStrokeStyle(bend.render_options.line_style);
      ctx.setFillStyle(bend.render_options.line_style);
      ctx.setLineWidth(bend.render_options.line_width);
      if (!continuedPeak) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, top);
        ctx.stroke();
      }
      const arrow = (ax, ay, direction) => {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 4, ay + direction * 5);
        ctx.lineTo(ax + 4, ay + direction * 5);
        ctx.closePath();
        ctx.fill();
      };
      if (!continuedPeak) arrow(x, top, 1);
      const amount = Math.abs(pre.bendalter) / 2;
      const quarters = Math.round(amount * 4);
      const fraction = quarters % 4;
      const label = amount === 1 ? "Full" : Number.isInteger(amount) ? String(amount) : Math.abs(quarters / 4 - amount) < 1e-8
        ? (quarters >= 4 ? Math.floor(quarters / 4) + " " : "") + (fraction === 2 ? "1/2" : fraction + "/4") : String(amount);
      ctx.setRawFont(bend.font);
      if (!continuedPeak) ctx.fillText(label, x - ctx.measureText(label).width / 2, top - 4);
      if (continuedPeak && !release && endX > x) {
        ctx.setLineDash?.([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(endX, top);
        ctx.stroke();
        ctx.setLineDash?.([]);
      }
      if (release && releaseNote) {
        if (holdX > x) {
          ctx.setLineDash?.([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x + 5, top);
          ctx.lineTo(holdX, top);
          ctx.stroke();
          ctx.setLineDash?.([]);
        }
        ctx.beginPath();
        ctx.moveTo(holdX, top);
        ctx.quadraticCurveTo(endX, top, endX, y);
        ctx.stroke();
        arrow(endX, y, -1);
      }
      ctx.restore();
      ctx.closeGroup?.();
      bend.setRendered();
      return;
    }
    const pairs = [];
    for (let i = 0; i + 1 < entries.length; i++) {
      const start = entries[i];
      const release = entries[i + 1];
      if (start.notes.length !== 1 || release.notes.length !== 1) {
        continue;
      }
      const a = start.notes[0].sourceNote;
      const b = release.notes[0].sourceNote;
      if (a.BendArray?.length !== 1 || b.BendArray?.length !== 1 || a.BendArray[0].direction !== "up" || b.BendArray[0].direction !== "down" || b.FretVisible !== false || !b.FretParentheses || a.StringNumberTab !== b.StringNumberTab || a.FretNumber !== b.FretNumber || Math.abs(a.BendArray[0].bendalter) !== Math.abs(b.BendArray[0].bendalter) || start.parentVoiceEntry.IsGrace || release.parentVoiceEntry.IsGrace) {
        continue;
      }
      const end = entries.slice(i + 2).find((entry) => entry.notes.length === 1 && entry.notes[0].vfnote?.[0]?.getTickContext?.());
      if (!end || end.notes[0].sourceNote.StringNumberTab !== a.StringNumberTab || end.notes[0].sourceNote.FretNumber !== a.FretNumber) {
        continue;
      }
      pairs.push({ start, release, end, startIndex: i });
    }
    const pair = pairs.find((candidate) => candidate.startIndex === index || candidate.startIndex + 1 === index);
    if (!pair) {
      originalDraw();
      return;
    }
    if (pair.release === gve) {
      return;
    }
    const target = noteAt(pair.release);
    const endNote = noteAt(pair.end);
    if (!target || !endNote) {
      originalDraw();
      return;
    }
    const x = vfNote.getModifierStartXY(2, 0).x + 3;
    const peakX = xAt(pair.release) + target.glyph.getWidth() / 2;
    const endX = xAt(pair.end) - 3;
    const y = vfNote.getYs()[0] + 0.5;
    const top = vfNote.getStave().getYForTopText(bend.text_line) + 3;
    if (![x, peakX, endX, y, top].every(Number.isFinite) || peakX <= x || endX <= peakX) {
      originalDraw();
      return;
    }
    const ctx = bend.context;
    ctx.openGroup?.("tab-bend-span");
    ctx.save();
    ctx.setStrokeStyle(bend.render_options.line_style);
    ctx.setFillStyle(bend.render_options.line_style);
    ctx.setLineWidth(bend.render_options.line_width);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(peakX, y, peakX, top);
    ctx.quadraticCurveTo(endX, top, endX, y);
    ctx.stroke();
    for (const [arrowX, arrowY, direction] of [[peakX, top, 1], [endX, y, -1]]) {
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 4, arrowY + direction * 4);
      ctx.lineTo(arrowX + 4, arrowY + direction * 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.setRawFont(bend.font);
    const label = bend.phrase[0].text;
    ctx.fillText(label, peakX - ctx.measureText(label).width / 2, top - 4);
    ctx.restore();
    ctx.closeGroup?.();
    bend.setRendered();
  };
}
export {
  configureTabBendLayout
};
