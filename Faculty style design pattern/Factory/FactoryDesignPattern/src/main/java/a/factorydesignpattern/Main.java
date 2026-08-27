package a.factorydesignpattern;

// 1. Product Interface
interface Transport {
    String delivery();
}

// 2. Concrete Products
class Truck implements Transport {
    @Override
    public String delivery() {
        return "Truck will be delivering your product!";
    }
}

class Ship implements Transport {
    @Override
    public String delivery() {
        return "Ship will be delivering your product!";
    }
}

class Plane implements Transport {
    @Override
    public String delivery() {
        return "Plan will be delivering your product!";
    }
}

// 3. Creator Interface
interface RoadLogistic {
    String order();
}

// 4. Concrete Creators using instant instantiation & method calling
class TruckLogistic implements RoadLogistic {
    @Override
    public String order() {
        return "Your goods and products are shipped now\n" + new Truck().delivery();
    }
}

class SeaLogistic implements RoadLogistic {
    @Override
    public String order() {
        return "Your goods and products are shipped now\n" + new Ship().delivery();
    }
}

class AirLogistic implements RoadLogistic {
    @Override
    public String order() {
        return "Your goods and products are shipped now\n" + new Plane().delivery();
    }
}

// 5. Client Execution
public class Main {
    public static void clientCode(RoadLogistic logistic) {
        System.out.println("Don't worry about your products and the transportation");
        System.out.println(logistic.order());
    }

    public static void main(String[] args) {
        RoadLogistic logistic1 = new TruckLogistic();
        clientCode(logistic1);

        System.out.println();

        RoadLogistic logistic2 = new SeaLogistic();
        clientCode(logistic2);

        System.out.println();

        RoadLogistic logistic3 = new AirLogistic();
        clientCode(logistic3);
    }
}
