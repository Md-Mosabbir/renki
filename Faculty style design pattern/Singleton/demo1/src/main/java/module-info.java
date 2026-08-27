module a.demo1 {
    requires javafx.controls;
    requires javafx.fxml;


    opens a.demo1 to javafx.fxml;
    exports a.demo1;
}