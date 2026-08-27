module a.factorydesignpattern {
    requires javafx.controls;
    requires javafx.fxml;


    opens a.factorydesignpattern to javafx.fxml;
    exports a.factorydesignpattern;
}