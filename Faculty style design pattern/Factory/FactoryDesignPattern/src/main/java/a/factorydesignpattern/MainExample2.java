package a.factorydesignpattern;
import java.util.HashMap;

// 1. Enum for Food Types
enum FoodType {
    PIZZA,
    PASTA
}

// 2. Abstract Product
interface FoodItem {
    void prepare();
}

// 3. Concrete Products
class CheesePizza implements FoodItem {
    @Override
    public void prepare() {
        System.out.println("Preparing Cheese Pizza");
    }
}

class Pepperoni implements FoodItem {
    @Override
    public void prepare() {
        System.out.println("Preparing Pepperoni Pizza");
    }
}

class Spaghetti implements FoodItem {
    @Override
    public void prepare() {
        System.out.println("Preparing Spaghetti");
    }
}

// 4. Abstract Factory
interface FoodFactory {
    FoodItem createFood();
}

// 5. Concrete Factories
class CheesePizzaFactory implements FoodFactory {
    @Override
    public FoodItem createFood() {
        return new CheesePizza();
    }
}

class PepperoniPizzaFactory implements FoodFactory {
    @Override
    public FoodItem createFood() {
        return new Pepperoni();
    }
}

class SpaghettiFactory implements FoodFactory {
    @Override
    public FoodItem createFood() {
        return new Spaghetti();
    }
}

// 6. Singleton Factory Registry
class FactoryRegistry {
    private static final FactoryRegistry INSTANCE = new FactoryRegistry();
    private final HashMap<FoodType, FoodFactory> factories = new HashMap<>();

    private FactoryRegistry() {}

    public static FactoryRegistry getInstance() {
        return INSTANCE;
    }

    public void registerFactory(FoodType type, FoodFactory factory) {
        factories.put(type, factory);
    }

    public FoodFactory getFactory(FoodType type) {
        return factories.get(type);
    }
}

// 7. Client Execution
public class MainExample2 {
    public static void main(String[] args) {
        FactoryRegistry registry = FactoryRegistry.getInstance();
        //FactoryRegistry registry2 = FactoryRegistry.getInstance();

        // Register Factories
        registry.registerFactory(FoodType.PIZZA, new CheesePizzaFactory());
        registry.registerFactory(FoodType.PASTA, new SpaghettiFactory());


        // Simulate Customer Order
        FoodType customerOrder = FoodType.PIZZA;
        FoodFactory factory = registry.getFactory(customerOrder);

        if (factory != null) {
            FoodItem food = factory.createFood();
            food.prepare();
        } else {
            System.out.println("No factory found for the requested food type!");
        }

        //System.out.println(System.identityHashCode(registry));
        //System.out.println(System.identityHashCode(registry2));

    }
}