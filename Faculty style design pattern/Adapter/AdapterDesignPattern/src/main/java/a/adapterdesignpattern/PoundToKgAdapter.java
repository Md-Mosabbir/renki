package a.adapterdesignpattern;

public class PoundToKgAdapter implements WeightSensor{
    private final PoundScale poundScale;

    public PoundToKgAdapter(PoundScale poundScale){
        this.poundScale = poundScale;
    }


    @Override
    public double getWeightInKg(String object) {
        double weightInLbs = poundScale.getWeightInLbs(object);
        double weightInKgs = weightInLbs * 0.453592;
        return weightInKgs;
    }
}
