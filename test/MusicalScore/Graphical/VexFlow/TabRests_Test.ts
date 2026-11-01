import { expect } from "chai";
import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";

describe("Explicit TAB rest glyphs", () => {
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
    it("draws a quarter rest and retains its notated duration", async () => {
        const osmd: OpenSheetMusicDisplay = await render(score('<note><rest/><duration>1</duration><type>quarter</type></note>'));
        expect(div.querySelectorAll(".vf-tab-rest path").length).to.be.greaterThan(0);
        expect(osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries[0].graphicalVoiceEntries[0].notes[0].sourceNote.Length.RealValue).to.equal(0.25);
    });
    it("draws an explicit whole-measure rest once", async () => {
        await render(score('<note><rest measure="yes"/><duration>4</duration></note>'));
        expect(div.querySelectorAll(".vf-tab-rest")).to.have.length(1);
        expect(div.querySelectorAll(".vf-tab-rest path").length).to.be.greaterThan(0);
    });
    it("respects a hidden rest", async () => {
        await render(score('<note print-object="no"><rest/><duration>1</duration><type>quarter</type></note>'));
        expect(div.querySelectorAll(".vf-tab-rest")).to.have.length(0);
    });
});
