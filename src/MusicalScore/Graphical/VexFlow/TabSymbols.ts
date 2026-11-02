import Vex from "vexflow";
import VF = Vex.Flow;
import { TabNote, TabSlide } from "../../VoiceData/TabNote";
import { Note } from "../../VoiceData/Note";
import { VoiceEntry } from "../../VoiceData/VoiceEntry";
import { VexFlowMeasure } from "./VexFlowMeasure";
import { VexFlowTabMeasure } from "./VexFlowTabMeasure";
import { VexFlowVoiceEntry } from "./VexFlowVoiceEntry";
import { unitInPixels } from "./VexFlowMusicSheetDrawer";

export function setTabSlideDash(context: Vex.IRenderContext, lineType: string): void {
    // Both VexFlow backends accept arrays; the 1.x declarations only describe the string overload.
    (context as unknown as {setLineDash(dashes: number[]): void}).setLineDash(lineType === "dashed" ? [3, 3] : []);
}

/** Use the origin's style even when the stop marker omits line-type. */
export function tabSlideLineType(first: TabNote, last: TabNote): string {
    return first.TabSlides.find(start => start.type === "start" && last.TabSlides.some(stop =>
        stop.type === "stop" && stop.number === start.number))?.lineType ?? "solid";
}

/** Draw straight doits and slides that are not already represented by native glissandi. */
export function drawTabSymbols(measure: VexFlowTabMeasure, context: Vex.IRenderContext): void {
    for (const staffEntry of measure.staffEntries) {
        for (const graphicalEntry of staffEntry.graphicalVoiceEntries) {
            const entry: VexFlowVoiceEntry = graphicalEntry as VexFlowVoiceEntry;
            if (entry.parentVoiceEntry.IsGrace || !entry.vfStaveNote) {
                continue;
            }
            // Each chord member can carry its own slide or doit on its own string.
            for (const graphicalNote of entry.notes) {
                const source: Note = graphicalNote.sourceNote;
                if (!(source instanceof TabNote) || !source.PrintObject) {
                    continue;
                }
                const x: number = entry.vfStaveNote.getAbsoluteX();
                const width: number = (entry.vfStaveNote.getGlyph() as unknown as {getWidth(): number}).getWidth();
                const y: number = measure.getVFStave().getYForLine(source.StringNumberTab - 1);
                context.save();
                try {
                    context.setStrokeStyle(measure.rules.DefaultColorMusic);
                    context.setLineWidth(1.5);
                    if (source.TabDoit === "straight") {
                        context.openGroup("tab-doit");
                        context.beginPath();
                        context.moveTo(x + width + 3, y - 2);
                        context.lineTo(x + width + 20, y - 17);
                        context.stroke();
                        context.closeGroup();
                    }
                    drawSlides(measure, context, entry, source, x, width, y);
                } finally {
                    context.restore();
                }
            }
        }
    }
}

/** A future measure still owns a temporary VexFlow stave while an earlier one draws. */
function laidOutX(entry: VexFlowVoiceEntry): number {
    const note: VF.StemmableNote = entry.vfStaveNote;
    if (!note?.getTickContext()) {
        return NaN;
    }
    const measure: VexFlowMeasure = entry.parentStaffEntry.parentMeasure as VexFlowMeasure;
    const stave: VF.Stave = measure.getVFStave();
    return note.getAbsoluteX() + measure.PositionAndShape.AbsolutePosition.x * unitInPixels +
        stave.getNoteStartX() - stave.getX() - note.getStave().getNoteStartX();
}

function matchingSlide(entry: VexFlowVoiceEntry, source: TabNote, marker: TabSlide): TabNote {
    const voiceEntries: VoiceEntry[] = entry.parentVoiceEntry.ParentVoice.VoiceEntries;
    const index: number = voiceEntries.indexOf(entry.parentVoiceEntry);
    const forward: boolean = marker.type === "start";
    const candidates: VoiceEntry[] = forward ? voiceEntries.slice(index + 1) : voiceEntries.slice(0, index).reverse();
    for (const candidate of candidates) {
        if (candidate.IsGrace) {
            continue;
        }
        const other: TabNote = candidate.Notes.find(note => note instanceof TabNote && note.StringNumberTab === source.StringNumberTab &&
            note.TabSlides.some(slide => slide.number === marker.number && slide.type === (forward ? "stop" : "start"))) as TabNote;
        if (other) {
            return other;
        }
        if (candidate.Notes.some(note => note.isRest() || (note instanceof TabNote && note.StringNumberTab === source.StringNumberTab &&
            note.TabSlides.some(slide => slide.number === marker.number && slide.type === marker.type)))) {
            break;
        }
    }
    return undefined;
}

function drawSlides(measure: VexFlowTabMeasure, context: Vex.IRenderContext, entry: VexFlowVoiceEntry,
                    source: TabNote, x: number, width: number, y: number): void {
    for (const marker of source.TabSlides) {
        if (!["start", "stop"].includes(marker.type) || !["solid", "dashed"].includes(marker.lineType)) {
            continue;
        }
        // Native glissandi receive the same parsed style in VexFlowMusicSheetDrawer.
        if (source.NoteGlissando?.StartNote && source.NoteGlissando.EndNote) {
            continue;
        }
        const forward: boolean = marker.type === "start";
        const other: TabNote = matchingSlide(entry, source, marker);
        const otherEntry: VexFlowVoiceEntry = other && measure.rules.GNote(other)?.parentVoiceEntry as VexFlowVoiceEntry;
        if (!otherEntry?.vfStaveNote?.getTickContext()) {
            continue;
        }
        const otherMeasure: VexFlowMeasure = otherEntry.parentStaffEntry.parentMeasure as VexFlowMeasure;
        const sameLine: boolean = otherMeasure.ParentStaffLine === measure.ParentStaffLine;
        if (!forward && sameLine) {
            continue; // Already painted by the origin.
        }
        const direction: number = Math.sign(forward ? other.FretNumber - source.FretNumber : source.FretNumber - other.FretNumber);
        let startX: number, endX: number, startY: number, endY: number;
        if (forward) {
            startX = x + width + 3;
            startY = y + direction * 4;
            const measures: VexFlowMeasure[] = measure.ParentStaffLine.Measures as VexFlowMeasure[];
            let lastMeasure: VexFlowMeasure = measures[measures.length - 1];
            if (lastMeasure.IsExtraGraphicalMeasure) {
                lastMeasure = lastMeasure.ExtraGraphicalMeasurePreviousMeasure as VexFlowMeasure;
            }
            endX = sameLine ? laidOutX(otherEntry) - 3 :
                lastMeasure.PositionAndShape.AbsolutePosition.x * unitInPixels + lastMeasure.getVFStave().getWidth() - 3;
            endY = sameLine ? y - direction * 4 : y;
        } else {
            const firstMeasure: VexFlowMeasure = measure.ParentStaffLine.Measures[0] as VexFlowMeasure;
            startX = firstMeasure.PositionAndShape.AbsolutePosition.x * unitInPixels + firstMeasure.beginInstructionsWidth * unitInPixels;
            endX = x - 3;
            startY = y;
            endY = y - direction * 4;
        }
        if (![startX, endX, startY, endY].every(Number.isFinite) || endX <= startX) {
            continue;
        }
        context.openGroup("tab-slide");
        try {
            setTabSlideDash(context, forward ? marker.lineType : tabSlideLineType(other, source));
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
            context.stroke();
        } finally {
            setTabSlideDash(context, "solid");
            context.closeGroup();
        }
    }
}
