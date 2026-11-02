import Vex from "vexflow";
import VF = Vex.Flow;
import { GraphicalVoiceEntry } from "../GraphicalVoiceEntry";
import { TabNote, TabBendSegment } from "../../VoiceData/TabNote";
import { VexFlowMeasure } from "./VexFlowMeasure";
import { VexFlowVoiceEntry } from "./VexFlowVoiceEntry";
import { unitInPixels } from "./VexFlowMusicSheetDrawer";

export interface TabBendPhrase {
    type: number;
    text: string;
    width?: number;
    draw_width?: number;
}

/** Runtime methods/properties missing from the VexFlow 1.x declarations. */
interface TabBendNote extends VF.TabNote {
    getModifiers(): VF.Modifier[];
    getGlyph(): VF.Glyph & {getWidth(): number};
    tabFretNumbersSuppressed?: boolean;
}

/** Format semitone intervals consistently for ordinary bends and pre-bends. */
export function formatTabBendInterval(semitones: number): string {
    const tones: number = Math.abs(semitones) / 2;
    if (tones === 1) {
        return "Full";
    }
    if (Number.isInteger(tones)) {
        return String(tones);
    }
    const quarters: number = Math.round(tones * 4);
    if (Math.abs(quarters / 4 - tones) >= 1e-8) {
        return String(tones);
    }
    const remainder: number = quarters % 4;
    return (quarters >= 4 ? `${Math.floor(quarters / 4)} ` : "") + (remainder === 2 ? "1/2" : `${remainder}/4`);
}

function noteAt(entry: GraphicalVoiceEntry): TabBendNote {
    return (entry as VexFlowVoiceEntry)?.vfStaveNote as TabBendNote;
}

function sourceAt(entry: GraphicalVoiceEntry): TabNote {
    return entry?.notes.length === 1 ? entry.notes[0].sourceNote as TabNote : undefined;
}

function bendAt(entry: GraphicalVoiceEntry): TabBend {
    return noteAt(entry)?.getModifiers().find(modifier => modifier instanceof TabBend) as TabBend;
}

/** Future measures still use temporary stave coordinates until their own draw call. */
function laidOutX(entry: GraphicalVoiceEntry): number {
    const note: TabBendNote = noteAt(entry);
    const measure: VexFlowMeasure = entry.parentStaffEntry.parentMeasure as VexFlowMeasure;
    return note.getAbsoluteX() + measure.PositionAndShape.AbsolutePosition.x * unitInPixels +
        measure.getVFStave().getNoteStartX() - measure.getVFStave().getX() - note.getStave().getNoteStartX();
}

function measureEndX(measure: VexFlowMeasure): number {
    return measure.PositionAndShape.AbsolutePosition.x * unitInPixels + measure.getVFStave().getNoteEndX() - measure.getVFStave().getX();
}

function tied(first: TabNote, last: TabNote): boolean {
    return !!first && !!last && first.StringNumberTab === last.StringNumberTab && first.FretNumber === last.FretNumber &&
        first.ParentVoiceEntry.ParentVoice === last.ParentVoiceEntry.ParentVoice && [first.NoteTie, last.NoteTie].some(tie => {
            const index: number = tie?.Type === "" ? tie.Notes.indexOf(first) : -1;
            return index >= 0 && tie.Notes[index + 1] === last;
        });
}

function bendEnd(note: TabNote): number {
    return (note?.BendArray ?? []).reduce((value, segment) => segment.preBend ? segment.bendalter :
        value + (segment.direction === "down" ? -1 : 1) * Math.abs(segment.bendalter), 0);
}

function rising(note: TabNote): boolean {
    return note?.BendArray?.length === 1 && !note.BendArray[0].preBend &&
        note.BendArray[0].direction === "up" && note.BendArray[0].bendalter > 0;
}

/** A VexFlow bend with note/tie-aware geometry. Unhandled gestures retain VexFlow's drawing. */
export class TabBend extends VF.Bend {
    // These fields exist on VexFlow's Bend but are omitted from its 1.x type declarations.
    declare public phrase: TabBendPhrase[];
    declare public font: string;
    declare public text_line: number;
    declare public render_options: {line_style: string, line_width: number};
    declare public setRendered: () => void;
    private entry: VexFlowVoiceEntry;
    private combinedRelease: TabBend;

    constructor(entry: VexFlowVoiceEntry, phrases: TabBendPhrase[]) {
        // VexFlow computes width and draw_width when width is omitted; its declaration incorrectly requires width.
        super("", false, phrases as {type: number, text: string, width: number}[]);
        this.entry = entry;
    }

    public draw(): void {
        this.combinedRelease = undefined;
        const note: TabBendNote = this.getNote() as TabBendNote;
        if (this.entry.notes.length > 1) {
            if (!this.drawChord(note)) {
                super.draw();
            }
            return;
        }
        const measure: VexFlowMeasure = this.entry.parentStaffEntry.parentMeasure as VexFlowMeasure;
        const entries: GraphicalVoiceEntry[] = (measure.ParentStaffLine?.Measures ?? [measure])
            .flatMap(bar => bar.staffEntries).flatMap(staffEntry => staffEntry.graphicalVoiceEntries)
            .filter(voiceEntry => voiceEntry.parentVoiceEntry.ParentVoice === this.entry.parentVoiceEntry.ParentVoice);
        const index: number = entries.indexOf(this.entry);
        // Suppress this modifier only when its predecessor actually drew it, after validating all coordinates.
        if (bendAt(entries[index - 1])?.combinedRelease === this) {
            return;
        }
        const source: TabNote = sourceAt(this.entry);
        const segments: TabBendSegment[] = source.BendArray ?? [];
        const pre: TabBendSegment = segments.find(segment => segment.preBend && segment.bendalter !== 0);
        const tieIndex: number = source.NoteTie?.Type === "" ? source.NoteTie.Notes.indexOf(source) : -1;
        const incoming: TabNote = sourceAt(entries[index - 1]) ??
            (tieIndex > 0 ? source.NoteTie.Notes[tieIndex - 1] as TabNote : undefined);
        const following: GraphicalVoiceEntry = this.nextFormatted(entries, index + 1);
        if (this.drawTiedRise(note, source, incoming, sourceAt(entries[index + 1]), following, measure)) {
            return;
        }
        if (pre && this.drawPreBend(note, pre, incoming, entries, index, measure)) {
            return;
        }
        if (!this.drawHiddenRelease(note, entries, index)) {
            super.draw();
        }
    }

    private nextFormatted(entries: GraphicalVoiceEntry[], index: number): GraphicalVoiceEntry {
        return entries.slice(index).find(voiceEntry => !voiceEntry.parentVoiceEntry.IsGrace && noteAt(voiceEntry)?.getTickContext());
    }

    private withContext(group: string, draw: (context: Vex.IRenderContext) => void): void {
        const context: Vex.IRenderContext = this.getContext();
        context.openGroup(group);
        context.save();
        try {
            context.setStrokeStyle(this.render_options.line_style);
            context.setFillStyle(this.render_options.line_style);
            context.setLineWidth(this.render_options.line_width);
            draw(context);
            this.setRendered();
        } finally {
            context.restore();
            context.closeGroup();
        }
    }

    private arrow(context: Vex.IRenderContext, x: number, y: number, direction: number): void {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x - 4, y + direction * 5);
        context.lineTo(x + 4, y + direction * 5);
        context.closePath();
        context.fill();
    }

    private label(context: Vex.IRenderContext, text: string, x: number, top: number): void {
        context.setRawFont(this.font);
        context.fillText(text, x - context.measureText(text).width / 2, top - 4);
    }

    private hold(context: Vex.IRenderContext, startX: number, endX: number, top: number): void {
        // The declarations accept only strings, while both VexFlow backends also accept numeric dash arrays.
        (context as unknown as {setLineDash(dashes: number[]): void}).setLineDash([3, 3]);
        context.beginPath();
        context.moveTo(startX, top);
        context.lineTo(endX, top);
        context.stroke();
        (context as unknown as {setLineDash(dashes: number[]): void}).setLineDash([]);
    }

    private drawChord(note: TabBendNote): boolean {
        const sources: TabNote[] = this.entry.notes.map(graphical => graphical.sourceNote as TabNote);
        const first: TabBendSegment = sources[0].BendArray?.[0];
        if (sources[0].BendArray?.length !== 1 || first.direction !== "up" || first.preBend || first.bendalter <= 0 ||
            !sources.every(source => source.BendArray?.length === 1 && source.BendArray[0].direction === "up" &&
                !source.BendArray[0].preBend && source.BendArray[0].bendalter === first.bendalter)) {
            return false;
        }
        const ys: number[] = note.getYs();
        const x: number = note.getModifierStartXY(VF.Modifier.Position.RIGHT, 0).x + 3;
        const peakX: number = x + 20;
        const top: number = Math.min(note.getStave().getYForTopText(this.text_line) + 3, Math.min(...ys) - 25);
        if (ys.length !== sources.length || ![x, peakX, top, ...ys].every(Number.isFinite)) {
            return false;
        }
        this.withContext("tab-chord-bend", context => {
            for (const y of ys) {
                context.beginPath();
                context.moveTo(x, y + 0.5);
                context.quadraticCurveTo(peakX, y + 0.5, peakX, top);
                context.stroke();
            }
            this.arrow(context, peakX, top, 1);
            this.label(context, this.phrase[0].text, peakX, top);
        });
        return true;
    }

    private drawTiedRise(note: TabBendNote, source: TabNote, incoming: TabNote, next: TabNote,
                         following: GraphicalVoiceEntry, measure: VexFlowMeasure): boolean {
        const nextPre: TabBendSegment = next?.BendArray?.find(segment => segment.preBend);
        const reachesPeak: boolean = rising(source) && tied(source, next) && nextPre?.bendalter === source.BendArray[0].bendalter;
        const followsRelease: boolean = rising(source) && tied(incoming, source) &&
            incoming.BendArray?.some(segment => segment.direction === "down" && segment.bendalter === source.BendArray[0].bendalter);
        if (!reachesPeak && !followsRelease) {
            return false;
        }
        const target: TabBendNote = noteAt(following);
        const x: number = note.getAbsoluteX() + (note.tabFretNumbersSuppressed ? 0 : note.getGlyph().getWidth() + 3);
        const y: number = note.getYs()[0] - 3;
        const peakX: number = reachesPeak && target ? laidOutX(following) + target.getGlyph().getWidth() / 2
            : target ? laidOutX(following) - 4 : measureEndX(measure) - 4;
        const peakBend: TabBend = reachesPeak ? bendAt(following) : this;
        const top: number = Math.min(note.getStave().getYForTopText(peakBend?.text_line ?? this.text_line) + 3, y - 30);
        if (![x, y, peakX, top].every(Number.isFinite) || peakX <= x || top >= y) {
            return false;
        }
        this.withContext("tab-tied-bend-rise", context => {
            context.beginPath();
            context.moveTo(x, y);
            context.quadraticCurveTo(peakX, y, peakX, top);
            context.stroke();
            this.arrow(context, peakX, top, 1);
            this.label(context, this.phrase[0].text, peakX, top);
        });
        return true;
    }

    private drawPreBend(note: TabBendNote, pre: TabBendSegment, incoming: TabNote,
                        entries: GraphicalVoiceEntry[], index: number, measure: VexFlowMeasure): boolean {
        const source: TabNote = sourceAt(this.entry);
        const segments: TabBendSegment[] = source.BendArray;
        const movements: TabBendSegment[] = segments.filter(segment => !segment.preBend && segment.bendalter !== 0);
        if (segments.filter(segment => segment.preBend).length !== 1 || movements.length > 1 ||
            !movements.every(segment => segment.direction === "down" && Math.abs(segment.bendalter) === Math.abs(pre.bendalter))) {
            return false;
        }
        const continued: boolean = tied(incoming, source) && Math.abs(bendEnd(incoming) - pre.bendalter) < 1e-8;
        const next: TabNote = sourceAt(entries[index + 1]);
        const tiedRelease: GraphicalVoiceEntry = tied(source, next) && next.BendArray?.length === 1 &&
            !next.BendArray[0].preBend && next.BendArray[0].direction === "down" &&
            Math.abs(next.BendArray[0].bendalter) === Math.abs(pre.bendalter) ? entries[index + 1] : undefined;
        const release: GraphicalVoiceEntry = movements.length > 0 ? this.entry : tiedRelease;
        const afterRelease: GraphicalVoiceEntry = this.nextFormatted(entries, index + (tiedRelease ? 2 : 1));
        const x: number = note.getAbsoluteX() + note.getGlyph().getWidth() / 2;
        const y: number = note.getYs()[0] - 3;
        let peakEntry: GraphicalVoiceEntry = this.entry;
        if (continued) {
            for (let priorIndex: number = index - 1; priorIndex >= 0; priorIndex--) {
                const prior: TabNote = sourceAt(entries[priorIndex]);
                const after: TabNote = sourceAt(entries[priorIndex + 1]);
                if (!tied(prior, after) || Math.abs(bendEnd(prior) - pre.bendalter) > 1e-8 ||
                    !prior.BendArray?.some(segment => segment.preBend && segment.bendalter === pre.bendalter)) {
                    break;
                }
                peakEntry = entries[priorIndex];
            }
        }
        const peakNote: TabBendNote = noteAt(peakEntry);
        const peakBend: TabBend = bendAt(peakEntry);
        const top: number = Math.min(peakNote.getStave().getYForTopText(peakBend?.text_line ?? this.text_line) + 3, peakNote.getYs()[0] - 33);
        const holdX: number = release && release !== this.entry ? laidOutX(release) : x;
        const releaseMeasure: VexFlowMeasure = release?.parentStaffEntry.parentMeasure as VexFlowMeasure ?? measure;
        const endX: number = afterRelease ? laidOutX(afterRelease) - 4 : measureEndX(releaseMeasure) - 4;
        if (![x, y, top, holdX, endX].every(Number.isFinite) || top >= y || (release && (holdX < x || endX <= holdX))) {
            return false;
        }
        this.withContext(continued && !release ? "tab-bend-hold" : "tab-prebend", context => {
            if (!continued) {
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x, top);
                context.stroke();
                this.arrow(context, x, top, 1);
                this.label(context, formatTabBendInterval(pre.bendalter), x, top);
            }
            if (continued && !release && endX > x) {
                this.hold(context, x, endX, top);
            }
            if (release) {
                if (holdX > x) {
                    this.hold(context, x + 5, holdX, top);
                }
                context.beginPath();
                context.moveTo(holdX, top);
                context.quadraticCurveTo(endX, top, endX, y);
                context.stroke();
                this.arrow(context, endX, y, -1);
            }
        });
        if (tiedRelease) {
            this.combinedRelease = bendAt(tiedRelease);
        }
        return true;
    }

    private drawHiddenRelease(note: TabBendNote, entries: GraphicalVoiceEntry[], index: number): boolean {
        const release: GraphicalVoiceEntry = entries[index + 1];
        const first: TabNote = sourceAt(this.entry);
        const last: TabNote = sourceAt(release);
        if (!first || !last || first.BendArray?.length !== 1 || last.BendArray?.length !== 1 ||
            first.BendArray[0].direction !== "up" || last.BendArray[0].direction !== "down" ||
            last.FretVisible !== false || !last.FretParentheses || first.StringNumberTab !== last.StringNumberTab ||
            first.FretNumber !== last.FretNumber || Math.abs(first.BendArray[0].bendalter) !== Math.abs(last.BendArray[0].bendalter) ||
            this.entry.parentVoiceEntry.IsGrace || release.parentVoiceEntry.IsGrace) {
            return false;
        }
        const end: GraphicalVoiceEntry = entries.slice(index + 2).find(voiceEntry =>
            voiceEntry.notes.length === 1 && noteAt(voiceEntry)?.getTickContext());
        const endSource: TabNote = sourceAt(end);
        if (!endSource || endSource.StringNumberTab !== first.StringNumberTab || endSource.FretNumber !== first.FretNumber) {
            return false;
        }
        const x: number = note.getModifierStartXY(VF.Modifier.Position.RIGHT, 0).x + 3;
        const peakX: number = laidOutX(release) + noteAt(release).getGlyph().getWidth() / 2;
        const endX: number = laidOutX(end) - 3;
        const y: number = note.getYs()[0] + 0.5;
        const top: number = note.getStave().getYForTopText(this.text_line) + 3;
        if (![x, peakX, endX, y, top].every(Number.isFinite) || peakX <= x || endX <= peakX) {
            return false;
        }
        this.withContext("tab-bend-span", context => {
            context.beginPath();
            context.moveTo(x, y);
            context.quadraticCurveTo(peakX, y, peakX, top);
            context.quadraticCurveTo(endX, top, endX, y);
            context.stroke();
            this.arrow(context, peakX, top, 1);
            this.arrow(context, endX, y, -1);
            this.label(context, this.phrase[0].text, peakX, top);
        });
        this.combinedRelease = bendAt(release);
        return true;
    }
}
