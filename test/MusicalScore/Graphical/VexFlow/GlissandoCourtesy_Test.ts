import { expect } from "chai";
import { GraphicalGlissando } from "../../../../src/MusicalScore/Graphical/GraphicalGlissando";
import { EngravingRules } from "../../../../src/MusicalScore/Graphical/EngravingRules";

describe("Glissando source-less courtesy measures", () => {
    for (const hasEndLine of [false, true, undefined]) {
        it(`handles a courtesy measure with preceding HasEndLine=${hasEndLine}`, () => {
            const source: any = hasEndLine === undefined ? undefined : {HasEndLine: hasEndLine};
            const last: any = {IsExtraGraphicalMeasure: true,
                ExtraGraphicalMeasurePreviousMeasure: source ? {parentSourceMeasure: source} : undefined};
            const measures: any = [last];
            measures.last = () => last;
            const line: any = {Measures: measures, PositionAndShape: {Size: {width: 20}}};
            const measure: any = {ParentStaffLine: line, PositionAndShape: {RelativePosition: {x: 0}}};
            const entry: any = {parentMeasure: measure, PositionAndShape: {RelativePosition: {x: 1}}};
            const note: any = {PositionAndShape: {RelativePosition: {x: 1}, AbsolutePosition: {y: 4}},
                parentVoiceEntry: {parentStaffEntry: entry}};
            const start: any = {};
            entry.findGraphicalNoteFromNote = (n: any) => n === start ? note : undefined;
            const glissando: GraphicalGlissando = new GraphicalGlissando({StartNote: start, EndNote: {}, Direction: 0} as any);
            glissando.staffEntries = [entry];
            glissando.StaffLine = line;
            glissando.calculateLine(new EngravingRules());
            expect(Boolean(glissando.Line)).to.equal(!hasEndLine);
            expect(last.parentSourceMeasure).to.equal(undefined);
        });
    }
});
