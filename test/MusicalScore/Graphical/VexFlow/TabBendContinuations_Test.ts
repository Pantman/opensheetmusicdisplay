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
        <clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes>
        ${notes}</measure></part></score-partwise>`;
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
    function tiedNote(marker: string, pre: boolean): string {
        return `<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration>
            <tie type="${marker}"/><type>quarter</type><notations><tied type="${marker}"/>
            <technical><string>3</string><fret>9</fret>${bend(2, pre ? "<pre-bend/>" : "<release/>")}</technical></notations></note>`;
    }
    it("draws a terminal release across a barline with absolute coordinates, including on reflow", async () => {
        const xml: string = score(tiedNote("start", true)).replace("<beats>4</beats>", "<beats>1</beats>")
            .replace("</measure></part>", `</measure><measure number="2">${tiedNote("stop", false)}</measure></part>`);
        const osmd: OpenSheetMusicDisplay = await render(xml);
        function verify(): void {
            const first: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0);
            const last: any = osmd.GraphicSheet.findGraphicalMeasure(1, 0);
            expect(first.ParentStaffLine).to.equal(last.ParentStaffLine);
            const group: Element = div.querySelector(".vf-tab-prebend");
            expect(group).not.to.equal(null);
            // Vertical attack, held segment, release curve, and two arrowheads.
            expect(group.querySelectorAll("path")).to.have.length(5);
            const curves: Element[] = Array.from(group.querySelectorAll("path")).filter(path => path.getAttribute("d").includes("Q"));
            expect(curves).to.have.length(1);
            const numbers: number[] = curves[0].getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number);
            const endX: number = numbers[numbers.length - 2];
            expect(endX).to.be.closeTo(last.getVFStave().getNoteEndX() - 4, 0.01);
        }
        verify();
        osmd.render();
        verify();
    });
    it("retains the release modifier if combined pre-bend geometry cannot be drawn", async () => {
        const osmd: OpenSheetMusicDisplay = await render(score(tiedNote("start", true) + tiedNote("stop", false)));
        const entries: any[] = osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries.map(entry => entry.graphicalVoiceEntries[0]);
        const firstNote: any = entries[0].vfStaveNote;
        const firstBend: any = firstNote.getModifiers().find((modifier: any) => modifier.getCategory() === "bends");
        const releaseBend: any = entries[1].vfStaveNote.getModifiers().find((modifier: any) => modifier.getCategory() === "bends");
        const context: any = releaseBend.getContext();
        const originalX: () => number = firstNote.getAbsoluteX.bind(firstNote);
        const originalCurve: (...coordinates: number[]) => void = context.quadraticCurveTo.bind(context);
        let releaseCurves: number = 0;
        try {
            // A reversed horizontal span rejects combined drawing but still allows the native release.
            firstNote.getAbsoluteX = (): number => 100000;
            firstBend.draw();
            context.quadraticCurveTo = (...coordinates: number[]): void => {
                releaseCurves++;
                originalCurve(...coordinates);
            };
            releaseBend.draw();
            expect(releaseCurves).to.be.greaterThan(0);
        } finally {
            firstNote.getAbsoluteX = originalX;
            context.quadraticCurveTo = originalCurve;
        }
    });

});
