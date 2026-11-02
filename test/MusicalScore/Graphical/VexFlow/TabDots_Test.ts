import { expect } from "chai";
import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";

describe("TAB augmentation dots", () => {
    let div: HTMLElement;
    afterEach(() => { div?.remove(); });
    async function render(xml: string): Promise<OpenSheetMusicDisplay> {
        div = TestUtils.getDivElement(document);
        div.style.width = "1400px";
        const osmd: OpenSheetMusicDisplay = new OpenSheetMusicDisplay(div, {autoResize: false, backend: "svg"});
        await osmd.load(xml);
        osmd.render();
        expect(div.innerHTML).not.to.match(/NaN|Infinity/);
        return osmd;
    }
    function score(notes: string, divisions: number = 1): string {
        return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><attributes><divisions>${divisions}</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes>
        ${notes}</measure></part></score-partwise>`;
    }
    function note(duration: number, type: string, dots: number, chord: boolean = false): string {
        return `<note>${chord ? "<chord/>" : ""}<pitch><step>E</step><octave>3</octave></pitch><duration>${duration}</duration>
        <type>${type}</type>${"<dot/>".repeat(dots)}
        <notations><technical><string>${chord ? 3 : 4}</string><fret>2</fret></technical></notations></note>`;
    }
    for (const [dots, duration] of [[1, 6], [2, 7]]) {
        it(`draws ${dots} augmentation dots without changing ticks`, async () => {
            const osmd: OpenSheetMusicDisplay = await render(score(note(duration, "quarter", dots), 4));
            const graphical: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries[0].graphicalVoiceEntries[0].notes[0];
            const vf: any = graphical.vfnote[0];
            expect(vf.getModifiers().filter((m: any) => m.getCategory() === "dots")).to.have.length(dots);
            expect(vf.getDots()).to.equal(dots);
            expect(graphical.sourceNote.Length.RealValue).to.equal(duration / 16);
        });
    }
    it("adds one rhythmic dot to a chord rather than one per fret", async () => {
        const osmd: OpenSheetMusicDisplay = await render(score(note(3, "quarter", 1) + note(3, "quarter", 1, true), 2));
        const vf: any = (osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries[0].graphicalVoiceEntries[0].notes[0] as any).vfnote[0];
        expect(vf.getModifiers().filter((m: any) => m.getCategory() === "dots")).to.have.length(1);
        expect(vf.getDots()).to.equal(1);
    });
});
