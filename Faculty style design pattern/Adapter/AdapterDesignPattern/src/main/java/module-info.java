module a.adapterdesignpattern {
    requires javafx.controls;
    requires javafx.fxml;


    opens a.adapterdesignpattern to javafx.fxml;
    exports a.adapterdesignpattern;
}