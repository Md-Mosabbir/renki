package a.factorydesignpattern;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

// 1. Abstract Product
abstract class Pizza {
    protected String name;
    protected String dough = "";
    protected String sauce = "";
    protected List<String> toppings = new ArrayList<>();

    public void prepare() {
        System.out.println("Preparing " + name);
        System.out.println("\nTossing dough...");
        System.out.println("Adding sauce...");
        System.out.println("Adding toppings...");
        for (String topping : toppings) {
            System.out.println(" " + topping);
        }
        bake();
        cut();
        box();
    }

    public void bake() {
        System.out.println("Bake for 25 minutes at 350");
    }

    public void cut() {
        System.out.println("Cutting the pizza into diagonal slices");
    }

    public void box() {
        System.out.println("Place pizza in official PizzaStore box");
    }
}

// 2. Concrete Products
class CheesePizzaEg2 extends Pizza {
    public CheesePizzaEg2() {
        name = "Cheese Pizza";
        dough = "Thin Crust Dough";
        sauce = "Marinara Sauce";
        toppings.add("Grated Regiano Cheese");
        toppings.add("Shredded Cheese");
    }
}

class ClamsPizza extends Pizza {
    public ClamsPizza() {
        name = "Clams Pizza";
        dough = "Thin Crust Though";
        sauce = "Mariana Sauce";
        toppings.add("Grated Regiano Cheese");
        toppings.add("Fresh Clams");
    }
}

class VeggiePizza extends Pizza {
    public VeggiePizza() {
        name = "Veggie Pizza";
        dough = "Thin Crust Dough";
        sauce = "Marinara sauce";
        toppings.add("Grated Regiano Cheese");
        toppings.add("Fresh veggies");
    }
}

// 3. Abstract Factory Interface
interface PizzaFactory {
    Pizza createPizza(String name);
}

// 4. Concrete Factories
class VeggiePizzaFactory implements PizzaFactory {
    @Override
    public Pizza createPizza(String name) {
        return new VeggiePizza();
    }
}

class CheesePizzaFactoryEg2 implements PizzaFactory {
    @Override
    public Pizza createPizza(String name) {
        return new CheesePizzaEg2();
    }
}

class ClamsPizzaFactory implements PizzaFactory {
    @Override
    public Pizza createPizza(String name) {
        return new ClamsPizza();
    }
}

// 5. Singleton Factory Registry
class PizzaFactoryRegistry {
    private static final PizzaFactoryRegistry INSTANCE = new PizzaFactoryRegistry();
    private static final HashMap<String, PizzaFactory> factories = new HashMap<>();

    private PizzaFactoryRegistry() {}

    public static PizzaFactoryRegistry getInstance() {
        return INSTANCE;
    }

    public void registerFactory(String name, PizzaFactory factory) {
        factories.put(name, factory);
    }

    public PizzaFactory getFactory(String name) {
        return factories.get(name);
    }
}

// 6. Pizza Store Creator Context
class PizzaStore {
    public PizzaStore() {
        // Register all available factories into the Singleton Registry once
        PizzaFactoryRegistry registry = PizzaFactoryRegistry.getInstance();
        registry.registerFactory("CheesePizza", new CheesePizzaFactoryEg2());
        registry.registerFactory("ClamsPizza", new ClamsPizzaFactory());
        registry.registerFactory("VeggiePizza", new VeggiePizzaFactory());
    }

    public Pizza orderPizza(String type) {
        // Fetch the registered factory dynamically from the registry
        PizzaFactory factory = PizzaFactoryRegistry.getInstance().getFactory(type);

        if (factory == null) {
            System.out.println("Error: No factory registered for " + type);
            return null;
        }

        Pizza pizza = factory.createPizza(type);
        pizza.prepare();
        pizza.bake();
        pizza.cut();
        pizza.box();
        return pizza;
    }
}

// 7. Client Execution
public class MainExample3 {
    public static void main(String[] args) {
        PizzaStore pizzaStore = new PizzaStore();

        // The client simply passes strings; the store uses the registry behind the scenes!
        Pizza pizza1 = pizzaStore.orderPizza("CheesePizza");
        System.out.println("\n");
        Pizza pizza2 = pizzaStore.orderPizza("ClamsPizza");
    }
}
