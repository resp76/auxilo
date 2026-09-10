import XCTest

final class RelayCompanionUITests: XCTestCase {
    /// The companion opens on an intro screen. These tests skip it explicitly so
    /// they do not depend on whatever the simulator stored from a previous run.
    private func launchPastIntro() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-relay-skip-intro"]
        app.launch()
        return app
    }

    func testIntroAppearsBeforeAnyContactRequest() {
        let app = XCUIApplication()
        app.launchArguments = ["-relay-show-intro"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Relay Companion"].waitForExistence(timeout: 10))
        // Nothing may ask for contacts until the intro is acknowledged.
        XCTAssertFalse(app.buttons["Choose contacts"].exists)
        let start = app.buttons["Get started"]
        XCTAssertTrue(start.exists)
        start.tap()
        XCTAssertTrue(app.navigationBars["Relay Companion"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Choose contacts"].exists)
    }

    func testLaunchAndCancelContactPicker() {
        let app = launchPastIntro()
        XCTAssertTrue(app.navigationBars["Relay Companion"].waitForExistence(timeout: 10))
        app.buttons["Choose contacts"].tap()
        let picker = app.navigationBars["Contacts"]
        XCTAssertTrue(picker.waitForExistence(timeout: 5))
        let cancel = picker.buttons["Cancel"].exists ? picker.buttons["Cancel"] : picker.buttons["Back"]
        XCTAssertTrue(cancel.exists)
        cancel.tap()
        XCTAssertTrue(app.buttons["Choose contacts"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["Search selected contacts"].exists)
    }

    func testSelectSearchAndClearContact() {
        let app = launchPastIntro()
        app.buttons["Choose contacts"].tap()
        let picker = app.navigationBars["Contacts"]
        XCTAssertTrue(picker.waitForExistence(timeout: 5))
        // Standard contact shipped with the iPhone simulator.
        app.cells.matching(NSPredicate(format: "label == %@", "John Appleseed")).firstMatch.tap()
        picker.buttons["Done"].tap()
        let search = app.textFields["Search selected contacts"]
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Clear selected contacts"].exists)
        search.tap()
        search.typeText("John")
        XCTAssertTrue(app.staticTexts["John Appleseed"].exists)
        app.buttons["Clear selected contacts"].tap()
        XCTAssertFalse(app.staticTexts["John Appleseed"].exists)
    }

    func testEmptyExportOpensFilePicker() {
        let app = launchPastIntro()
        let export = app.buttons["Export selected contacts and events"]
        for _ in 0..<5 {
            if export.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(export.isHittable)
        export.tap()
        XCTAssertTrue(app.buttons["Export"].firstMatch.waitForExistence(timeout: 5) ||
                      app.buttons["Save"].firstMatch.waitForExistence(timeout: 5))
    }
}
