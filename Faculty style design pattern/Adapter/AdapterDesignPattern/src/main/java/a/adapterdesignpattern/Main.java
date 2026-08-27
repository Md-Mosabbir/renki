package a.adapterdesignpattern;

public class Main {
    public static void main(String[] args){
        PoundScale poundScale = new PoundScale();
        WeightSensor sensor = new PoundToKgAdapter(poundScale);

        System.out.println("Mouse weight in KG:"+sensor.getWeightInKg("Mouse"));
        System.out.println("Dumbbell weight in KG:"+sensor.getWeightInKg("Dumbbell"));
        System.out.println("Keyboard weight in KG:"+sensor.getWeightInKg("Keyboard"));
    }
}
