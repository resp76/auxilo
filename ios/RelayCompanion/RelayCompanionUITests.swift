import XCTest

final class RelayCompanionUITests: XCTestCase {
    func testLaunchAndCancelContactPicker() {
        let app = XCUIApplication()
        app.launch()
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
        let app = XCUIApplication()
        app.launch()
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
        let app = XCUIApplication()
        app.launch()
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
