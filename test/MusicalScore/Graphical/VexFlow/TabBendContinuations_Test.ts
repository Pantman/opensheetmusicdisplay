import { expect } from "chai";
import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";

describe("TAB bend continuations and chord geometry", () => {
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
    function bend(value: number, extra: string = ""): string {
        return `<bend><bend-alter>${value}</bend-alter>${extra}</bend>`;
    }
    function bentNote(amount: number, pre: boolean, chord: boolean = false, string: number = 3): string {
        return `<note>${chord ? "<chord/>" : ""}<pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type>
        <notations><technical><string>${string}</string><fret>9</fret>${bend(amount, pre ? "<pre-bend/>" : "")}</technical></notations></note>`;
    }
    it("shares one arrow and label across matching chord bends", async () => {
        await render(score(bentNote(1, false) + bentNote(1, false, true, 2)));
        expect(div.querySelectorAll(".vf-tab-chord-bend")).to.have.length(1);
        expect(div.querySelectorAll(".vf-tab-chord-bend text")).to.have.length(1);
    });
    it("retains separate notation for unequal chord bends", async () => {
        await render(score(bentNote(1, false) + bentNote(2, false, true, 2)));
        expect(div.querySelectorAll(".vf-tab-chord-bend")).to.have.length(0);
        const labels: string[] = Array.from(div.querySelectorAll("text")).map(e => e.textContent);
        expect(labels).to.include("1/2");
        expect(labels).to.include("Full");
    });
    it("renders a fresh pre-bend as a raised attack", async () => {
        await render(score(bentNote(2, true)));
        expect(div.querySelectorAll(".vf-tab-prebend")).to.have.length(1);
    });
    it("uses the incoming bend peak for a held continuation", async () => {
        const notes: string = `<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><tie type="start"/><type>quarter</type>
          <notations><tied type="start"/><technical><string>3</string><fret>9</fret>${bend(2)}</technical></notations></note>
          <note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><tie type="stop"/><type>quarter</type>
          <notations><tied type="stop"/><technical><string>3</string><fret>9</fret>${bend(2, "<pre-bend/>")}</technical></notations></note>`;
        await render(score(notes));
        expect(div.querySelectorAll(".vf-tab-tied-bend-rise")).to.have.length(1);
        expect(div.querySelectorAll(".vf-tab-bend-hold")).to.have.length(1);
        expect(div.querySelectorAll(".vf-tab-prebend")).to.have.length(0);
    });
});
