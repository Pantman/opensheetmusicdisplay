import { expect } from "chai";
import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";

describe("TAB slide and straight-doit instructions", () => {
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
        <clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes>${notes}</measure></part></score-partwise>`;
    }
    function slidingNote(fret: number, marker: string, doit: boolean = false): string {
        return `<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type>
        <notations><slur type="${marker}" number="1"/><slide type="${marker}" number="1" line-type="dashed"/>
        ${doit ? '<articulations><doit line-shape="straight"/></articulations>' : ""}
        <technical><string>3</string><fret>${fret}</fret></technical></notations></note>`;
    }
    it("retains parsed slide markers and paints a paired slide independently of a slur", async () => {
        const osmd: OpenSheetMusicDisplay = await render(score(slidingNote(12, "start") + slidingNote(14, "stop")));
        expect(div.querySelectorAll(".vf-tab-slide")).to.have.length(1);
        const source: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries[0].graphicalVoiceEntries[0].notes[0].sourceNote;
        expect(source.TabSlides).to.deep.equal([{type: "start", number: "1", lineType: "dashed"}]);
    });
    it("renders a straight doit without adding another source note", async () => {
        const osmd: OpenSheetMusicDisplay = await render(score(slidingNote(12, "start", true)));
        expect(div.querySelectorAll(".vf-tab-doit")).to.have.length(1);
        expect(osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries).to.have.length(1);
    });
});
