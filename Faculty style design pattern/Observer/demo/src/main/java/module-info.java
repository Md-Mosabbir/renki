module a.demo {
    requires javafx.controls;
    requires javafx.fxml;


    opens a.demo to javafx.fxml;
    exports a.demo;
}