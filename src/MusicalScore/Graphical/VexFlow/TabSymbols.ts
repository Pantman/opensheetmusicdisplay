import { VexFlowConverter } from "./VexFlowConverter";

/** Draw explicit TAB rests and slide/doit instructions without changing musical timing. */
export function drawTabSymbols(this: any, ctx: any): void {
    const entries = this.staffEntries.flatMap((e: any) => e.graphicalVoiceEntries);
    for (const entry of entries) {
      const source = entry.notes[0]?.sourceNote;
      const vf = entry.vfStaveNote;
      if (!source || !vf || !source.PrintObject || entry.parentVoiceEntry.IsGrace) continue;
      if (source.isRest()) {
        const rest = VexFlowConverter.StaveNote(entry) as any;
        rest.setStave(this.stave);
        rest.setContext(ctx);
        rest.setTickContext(vf.getTickContext());
        rest.preFormat();
        const fillsMeasure = source.Length.RealValue === this.parentSourceMeasure.Duration.RealValue &&
          entry.parentVoiceEntry.Timestamp.RealValue === 0;
        if (source.IsWholeMeasureRest || fillsMeasure) {
          const center = (this.stave.getNoteStartX() + this.stave.getNoteEndX()) / 2;
          rest.setXShift(center - rest.getAbsoluteX() - rest.glyph.getWidth() / 2);
        }
        ctx.openGroup("tab-rest");
        rest.draw();
        ctx.closeGroup();
        continue;
      }
      if (entry.notes.length !== 1) continue;
      const x = vf.getAbsoluteX();
      const width = vf.glyph.getWidth();
      const y = this.stave.getYForLine(source.StringNumberTab - 1);
      ctx.save();
      ctx.setStrokeStyle(this.rules.DefaultColorMusic);
      ctx.setLineWidth(1.5);
      if (source.TabDoit === "straight") {
        ctx.openGroup("tab-doit");
        ctx.beginPath();
        ctx.moveTo(x + width + 3, y - 2);
        ctx.lineTo(x + width + 20, y - 17);
        ctx.stroke();
        ctx.closeGroup();
      }
      drawSlides.call(this, ctx, entry, source, x, width, y);
      ctx.restore();
    }
}

/** A future measure still owns a temporary VexFlow stave while an earlier one draws. */
function laidOutX(entry: any): number {
  const note = entry.vfStaveNote;
  if (!note?.getTickContext()) return NaN;
  const bar = entry.parentStaffEntry.parentMeasure;
  return note.getAbsoluteX() + bar.PositionAndShape.AbsolutePosition.x * 10 +
    bar.stave.getNoteStartX() - bar.stave.getX() - note.getStave().getNoteStartX();
}

function drawSlides(this: any, ctx: any, entry: any, source: any, x: number, width: number, y: number): void {
  const voiceEntries = entry.parentVoiceEntry.ParentVoice.VoiceEntries;
  const index = voiceEntries.indexOf(entry.parentVoiceEntry);
  for (const marker of source.TabSlides ?? []) {
    if (!["start", "stop"].includes(marker.type) || !["solid", "dashed"].includes(marker.lineType)) continue;
    // Keep OSMD's native glissandi, including its system-break segments.
    if (source.NoteGlissando?.StartNote && source.NoteGlissando.EndNote) continue;
    const forward = marker.type === "start";
    const candidates = forward ? voiceEntries.slice(index + 1) : voiceEntries.slice(0, index).reverse();
    let other: any;
    for (const candidate of candidates) {
      if (candidate.IsGrace) continue;
      const note = candidate.Notes.find((n: any) => n.StringNumberTab === source.StringNumberTab &&
        n.TabSlides?.some((s: any) => s.number === marker.number &&
          s.type === (forward ? "stop" : "start")));
      if (note) { other = note; break; }
      // An intervening rest or a new start with this number breaks the pairing.
      if (candidate.Notes.some((n: any) => n.isRest() || (n.StringNumberTab === source.StringNumberTab && n.TabSlides?.some((s: any) =>
          s.number === marker.number && s.type === marker.type)))) break;
    }
    const graphical = other && this.rules.GNote(other);
    const otherEntry = graphical?.parentVoiceEntry;
    if (!otherEntry?.vfStaveNote?.getTickContext()) continue;
    const otherBar = otherEntry.parentStaffEntry.parentMeasure;
    const sameLine = otherBar.ParentStaffLine === this.ParentStaffLine;
    if (!forward && sameLine) continue; // Already painted by the origin.
    const direction = Math.sign(forward ? other.FretNumber - source.FretNumber : source.FretNumber - other.FretNumber);
    let startX: number, endX: number, startY: number, endY: number;
    if (forward) {
      startX = x + width + 3; startY = y + direction * 4;
      const lastBar = this.ParentStaffLine.Measures.at(-1);
      endX = sameLine ? laidOutX(otherEntry) - 3 :
        lastBar.PositionAndShape.AbsolutePosition.x * 10 + lastBar.stave.getWidth() - 3;
      endY = sameLine ? y - direction * 4 : y;
    } else {
      startX = this.ParentStaffLine.Measures[0].PositionAndShape.AbsolutePosition.x * 10 + 3;
      endX = x - 3; startY = y; endY = y - direction * 4;
    }
    if (![startX, endX, startY, endY].every(Number.isFinite) || endX <= startX) continue;
    const lineType = forward ? marker.lineType :
      other.TabSlides.find((s: any) => s.type === "start" && s.number === marker.number)?.lineType;
    ctx.openGroup("tab-slide");
    ctx.setLineDash?.(lineType === "dashed" ? [3, 3] : []);
    ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
    ctx.setLineDash?.([]); ctx.closeGroup();
  }
}
