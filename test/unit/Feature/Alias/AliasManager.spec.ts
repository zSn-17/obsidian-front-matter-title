import { mock } from "jest-mock-extended";
import AliasManagerStrategyInterface from "@src/Feature/Alias/Interfaces/AliasManagerStrategyInterface";
import { MetadataCacheFactory } from "@config/inversify.factory.types";
import { CachedMetadata, FrontMatterCache, MetadataCache, MetadataCacheExt, Pos } from "obsidian";
import { AliasManager } from "@src/Feature/Alias/AliasManager";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import { Feature } from "@src/enum";

const mockStrategy = mock<AliasManagerStrategyInterface>();
const mockStrategyFactory = jest.fn(() => mockStrategy);
const mockCache = mock<MetadataCacheExt>();
const mockCacheFactory = jest.fn(() => mockCache);
const manager = new AliasManager(mockStrategyFactory, mock<LoggerInterface>(), mockCacheFactory);
const fooPath = "path/to/foo.md";
const barPath = "path/to/bar.md";
const quotePath = "path/to/quote.md";

describe("Test ID", () => {
    expect(manager.getId()).toEqual(Feature.Alias);
    expect(AliasManager.getId()).toEqual(Feature.Alias);
});

describe("Test disabled state", () => {
    test("Should not call dependencies", async () => {
        expect(manager.isEnabled()).toBeFalsy();
        await manager.update("path/to/file.md");
        await manager.refresh();
        await manager.disable();
        expect(mockCacheFactory).not.toHaveBeenCalled();
    });
});
test("Set strategy", () => {
    manager.setStrategy("strategy_name");
    expect(mockStrategyFactory).toHaveBeenCalledTimes(1);
    expect(mockStrategyFactory).toHaveBeenCalledWith("strategy_name");
    expect(mockStrategyFactory).toHaveReturnedWith(mockStrategy);
});

describe("Test enabled state", () => {
    beforeEach(() => {
        mockCache.getCache.mockClear();
        mockCache.getCachedFiles.mockClear();
        mockStrategy.process.mockClear();
        mockCacheFactory.mockClear();
    });
    test("Should be enabled", () => {
        manager.enable();
        expect(manager.isEnabled()).toBeTruthy();
    });

    test("Should set `bar` as alias by update", async () => {
        const value = "bar";
        mockStrategy.process.mockImplementationOnce(alias => alias.setValue(value));
        const cache = { frontmatter: { position: mock<Pos>() } as FrontMatterCache };
        mockCache.getCache.mockReturnValueOnce(cache);
        expect(await manager.update(barPath)).toBeTruthy();
        expect(cache.frontmatter).toHaveProperty("alias");
        expect(cache.frontmatter.alias).toEqual(value);
        expect(mockCacheFactory).toHaveBeenCalledTimes(1);
        expect(mockCache.getCache).toHaveBeenCalledTimes(1);
        expect(mockCache.getCache).toHaveBeenCalledWith(barPath);
        expect(mockStrategy.process).toHaveBeenCalledTimes(1);
    });
    test("Should not update because cache does not have frontmatter", async () => {
        const cache = {};
        mockCache.getCache.mockReturnValueOnce(cache);
        expect(await manager.update(fooPath)).toBeFalsy();
        expect(cache).toEqual({});
        expect(mockStrategy.process).not.toHaveBeenCalled();
        expect(mockCache.getCache).toHaveBeenCalledTimes(1);
        expect(mockCache.getCache).toHaveBeenCalledWith(fooPath);
        expect(mockCacheFactory).toHaveBeenCalledTimes(1);
    });

    test("Should set aliases by refresh", async () => {
        const values: { [k: string]: string } = {
            [barPath]: "bar_value",
            [fooPath]: "foo_value",
            [quotePath]: undefined,
        };
        mockStrategy.process.mockImplementation((alias, path) => {
            values[path] && alias.setValue(values[path]);
        });
        const caches: { [k: string]: CachedMetadata } = {
            [barPath]: { frontmatter: { position: mock<Pos>() } as FrontMatterCache },
            [fooPath]: { frontmatter: { position: mock<Pos>() } as FrontMatterCache },
            [quotePath]: { frontmatter: { position: mock<Pos>() } as FrontMatterCache },
        };
        mockCache.getCachedFiles.mockReturnValueOnce([barPath, fooPath, quotePath]);
        mockCache.getCache.mockImplementation(path => caches[path]);
        expect(await manager.refresh()).toEqual({ [barPath]: true, [fooPath]: true, [quotePath]: false });
        expect(caches[barPath].frontmatter.alias).toEqual("bar_value");
        expect(caches[fooPath].frontmatter.alias).toEqual("foo_value");
        expect(caches[quotePath].frontmatter).not.toHaveProperty("alias");
        expect(mockStrategy.process).toHaveBeenCalledTimes(3);
        expect(mockCache.getCachedFiles).toHaveBeenCalledTimes(1);
        expect(mockCache.getCache).toHaveBeenCalledTimes(3);
        expect(mockCacheFactory).toHaveBeenCalledTimes(4);
    });
});

test("Should restore after disable", async () => {
    const value = "bar";
    mockStrategy.process.mockImplementationOnce(alias => alias.setValue(value));
    const cache = { frontmatter: { position: mock<Pos>() } as FrontMatterCache };
    mockCache.getCache.mockReturnValueOnce(cache);
    expect(cache.frontmatter.alias).not.toEqual("bar");
    expect(await manager.update(fooPath)).toBeTruthy();
    expect(cache.frontmatter.alias).toEqual("bar");
    manager.disable();
    expect(manager.isEnabled()).toBeFalsy();
    expect(cache.frontmatter).not.toHaveProperty("alias");
});
