module a.proxy_design_pattern {
    requires javafx.controls;
    requires javafx.fxml;


    opens a.proxy_design_pattern to javafx.fxml;
    exports a.proxy_design_pattern;
}