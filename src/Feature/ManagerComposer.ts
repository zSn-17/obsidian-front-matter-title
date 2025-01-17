import FeatureComposer from "@src/Feature/FeatureComposer";
import { Feature } from "@src/enum";
import AbstractManager from "@src/Feature/AbstractManager";
import { inject, injectable, named } from "inversify";
import SI from "@config/inversify.types";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import DispatcherInterface from "@src/Components/EventDispatcher/Interfaces/DispatcherInterface";
import { AppEvents } from "@src/Types";
import Event from "@src/Components/EventDispatcher/Event";

@injectable()
export default class ManagerComposer {
    private ids: Feature[] = [Feature.Tab, Feature.Explorer, Feature.Starred, Feature.Search, Feature.Alias];

    constructor(
        @inject(SI["feature:composer"])
        private features: FeatureComposer,
        @inject(SI.logger)
        @named("composer:manager")
        private logger: LoggerInterface,
        @inject(SI.dispatcher)
        private dispatcher: DispatcherInterface<AppEvents>
    ) {}

    public async update(path: string, id: Feature = null): Promise<{ [K in Feature]?: boolean }> {
        const ids = id ? [id] : this.ids;
        const result: { [K in Feature]?: boolean } = {};
        const promises = [];
        for (const i of ids) {
            const manager = this.features.get<AbstractManager>(i);
            if (manager) {
                this.logger.log(`Run update for [${path}] on [${manager.getId()}]`);
                promises.push(
                    manager.update(path).then(r => {
                        result[i] = r;
                        this.dispatcher.dispatch("manager:update", new Event({ id: i, result: r }));
                    })
                );
            }
        }
        await Promise.all(promises);
        return result;
    }

    public async refresh(id: Feature = null): Promise<{ [K in Feature]?: { [k: string]: boolean } }> {
        this.logger.log("refresh");
        const ids = id ? [id] : this.ids;
        const result: { [K in Feature]?: { [k: string]: boolean } } = {};
        const promises = [];
        for (const i of ids) {
            const manager = this.features.get<AbstractManager>(i);
            if (manager) {
                promises.push(
                    manager.refresh().then(r => {
                        result[i] = r;
                        this.dispatcher.dispatch("manager:refresh", new Event({ id: i }));
                    })
                );
            }
        }
        await Promise.all(promises);
        return result;
    }
}
