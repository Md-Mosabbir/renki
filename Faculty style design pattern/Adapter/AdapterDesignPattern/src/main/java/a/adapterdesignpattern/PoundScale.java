package a.adapterdesignpattern;

import java.util.HashMap;

public class PoundScale {
    private final HashMap<String,Double> weights = new HashMap<>();

    public PoundScale(){
        weights.put("Dumbbell",5.00);
        weights.put("Mouse",0.56);
        weights.put("Headphone",1.2);
        weights.put("Mobile",0.78);
    }

    public double getWeightInLbs(String object){
        if(weights.get(object)==null){
            return 0.00;
        }
        //return weights.getOrDefault(object,0.0);
        return weights.get(object);
    }
}
