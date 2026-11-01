import { VexFlowConverter } from "./VexFlowConverter";

/** Draw explicit TAB rests without changing musical timing. */
export function drawTabRestSymbols(this: any, ctx: any): void {
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
    }
}
