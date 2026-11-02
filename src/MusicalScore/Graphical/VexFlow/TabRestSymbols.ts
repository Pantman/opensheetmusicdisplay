import Vex from "vexflow";
import VF = Vex.Flow;
import { Note } from "../../VoiceData/Note";
import { VexFlowConverter } from "./VexFlowConverter";
import { VexFlowTabMeasure } from "./VexFlowTabMeasure";
import { VexFlowVoiceEntry } from "./VexFlowVoiceEntry";

/** Draw explicit TAB rests without changing timing or the formatter's ghost notes. */
export function drawTabRestSymbols(measure: VexFlowTabMeasure, context: Vex.IRenderContext): void {
    if (!measure.rules.TabRestsRendered) {
        return;
    }
    const entries: VexFlowVoiceEntry[] = measure.staffEntries.flatMap(entry => entry.graphicalVoiceEntries) as VexFlowVoiceEntry[];
    for (const entry of entries) {
        const source: Note = entry.notes[0]?.sourceNote;
        const ghost: VF.StemmableNote = entry.vfStaveNote;
        if (!source?.isRest() || !ghost || !source.PrintObject || entry.parentVoiceEntry.IsGrace) {
            continue;
        }
        const rest: VF.StaveNote = VexFlowConverter.StaveNote(entry);
        const stave: VF.Stave = measure.getVFStave();
        rest.setStave(stave);
        rest.setContext(context);
        rest.setTickContext(ghost.getTickContext());
        rest.preFormat();
        const fillsMeasure: boolean = source.Length.RealValue === measure.parentSourceMeasure.ActiveTimeSignature.RealValue &&
            entry.parentVoiceEntry.Timestamp.RealValue === 0;
        if (source.IsWholeMeasureRest || fillsMeasure) {
            const center: number = (stave.getNoteStartX() + stave.getNoteEndX()) / 2;
            rest.setXShift(center - rest.getAbsoluteX() - (rest.getGlyph() as unknown as {getWidth(): number}).getWidth() / 2);
        }
        context.openGroup("tab-rest");
        try {
            rest.draw();
        } finally {
            context.closeGroup();
        }
    }
}
