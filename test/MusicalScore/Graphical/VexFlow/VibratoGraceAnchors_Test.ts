import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";
import { expect } from "chai";
import { VexFlowVibratoBracket } from "../../../../src/MusicalScore/Graphical/VexFlow/VexFlowVibratoBracket";

describe("Vibrato main-note anchors at grace boundaries", () => {
    for (const method of ["setStartNote", "setEndNote"]) {
        for (const mainPresent of [true, false]) {
            it(`${method} ${mainPresent ? "prefers the formatted main note" : "retains a grace-only fallback"}`, () => {
                const staffEntry: any = {graphicalVoiceEntries: [], parentMeasure: {staffEntries: []}};
                staffEntry.parentMeasure.staffEntries.push(staffEntry);
                const grace: any = {parentVoiceEntry: {IsGrace: true}, vfStaveNote: {}, parentStaffEntry: staffEntry};
                const main: any = {parentVoiceEntry: {IsGrace: false}, vfStaveNote: {}, parentStaffEntry: staffEntry};
                staffEntry.graphicalVoiceEntries = mainPresent ? [grace, main] : [grace];
                const bracket: any = Object.create(VexFlowVibratoBracket.prototype);
                expect(bracket[method](staffEntry)).to.equal(true);
                const expected: any = mainPresent ? main : grace;
                expect(bracket[method === "setStartNote" ? "startNote" : "endNote"]).to.equal(expected.vfStaveNote);
                expect(bracket[method === "setStartNote" ? "startVfVoiceEntry" : "endVfVoiceEntry"]).to.equal(expected);
            });
        }
    }    async function render(xml: string): Promise<{osmd: OpenSheetMusicDisplay, div: HTMLElement}> {
        const div: HTMLElement = TestUtils.getDivElement(document);
        const osmd: OpenSheetMusicDisplay = new OpenSheetMusicDisplay(div, {autoResize: false, backend: "svg"});
        await osmd.load(xml);
        osmd.render();
        expect(div.innerHTML).not.to.match(/NaN|Infinity/);
        return {osmd, div};
    }
    it("renders grace-boundary vibrato without an unformatted tick-context anchor", async () => {
        const {div} = await render(`<?xml version="1.0" encoding="UTF-8"?>
<!-- Original independent regression study; no third-party score material. -->
<score-partwise version="4.0">
  <work><work-title>Grace and vibrato anchors</work-title></work>
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>TAB</sign><line>5</line></clef></attributes>
      <note><grace slash="yes"/><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type><notations><technical>
        <string>3</string><fret>5</fret></technical></notations></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="start"/></ornaments><technical><string>3</string><fret>7</fret></technical></notations></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="stop"/></ornaments><technical><string>3</string><fret>5</fret></technical></notations></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="start"/></ornaments><technical><string>3</string><fret>7</fret></technical></notations></note>
      <note><grace slash="yes"/><pitch><step>B</step><octave>3</octave></pitch><voice>1</voice><type>eighth</type><notations><technical>
        <string>3</string><fret>4</fret></technical></notations></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="stop"/></ornaments><technical><string>3</string><fret>5</fret></technical></notations></note>
    </measure>
  </part>
</score-partwise>
`);
        try { expect(div.querySelectorAll("svg path").length).to.be.greaterThan(0); }
        finally { div.remove(); }
    });

});
