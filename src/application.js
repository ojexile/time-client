import { Avatar } from "./view/avatar/avatar.js";
import { AvatarManager } from "./view/avatar/manager.js";
import { Logger } from "./core/logging.js";
import { LoadingView } from "./view/loading-view.js";
import { Display } from "./display.js";
import { I18nManager } from "./core/i18n/i18n.js";
import { ConfigManager } from "./core/config/config.js";
import { initialLoadingDelay } from "./preferences.js";
import { InterfaceContainer, InterfaceManager } from "./ui/interface/interface.js";
import { RoomView } from "./view/room/room-view.js";
import { randomFigure, walkTo } from "./core/dev-utils.js";
import { Furni, FurniManager } from "./view/furni/furni.js";
import { RoomManager } from "./view/room/manager.js";

export class InitializerLoader extends PIXI.loaders.Loader
{

	constructor()
	{
		super();

		this.urls = [];
	}

	add(url, stage = 1)
	{
		this.urls.push({
			stage,
			url
		});

		return this;
	}

	load()
	{
		Logger.debug("InitializerLoader", "Skipped load() initializing..");
	}

	realLoad(cb, stage = 1)
	{
		this.urls
			.filter(url => url.stage === stage)
			.map(url => url.url)
			.forEach(url => super.add(url));

		super.load(cb);
	}

}

export class Application extends PIXI.utils.EventEmitter
{

	get display()
	{
		return this._display;
	}

	get loader()
	{
		return this._loader;
	}

	get stage()
	{
		return this.display.stage;
	}

	get ticker()
	{
		return this.display.ticker;
	}

	constructor()
	{
		super();

		this._display = new Display();
		this._loader = new InitializerLoader();

		this.managers = [];
	}

	addDefaultManagers()
	{
		this.addManager(new ConfigManager());
		this.addManager(new I18nManager());

		this.addManager(new AvatarManager());
		this.addManager(new FurniManager());
		this.addManager(new RoomManager());

		this.addManager(new InterfaceManager());
	}

	addManager(manager)
	{
		Logger.debug("Application", `Added manager ${manager.constructor.name}`);
		this.managers.push(manager);
	}

	getManager(managerClass)
	{
		return this.managers.find(manager => manager instanceof managerClass);
	}

	create()
	{
		this.loadingView = new LoadingView();
		this.loadingView.on("loader-ready", () => this.emit("application-can-run"));
		this.stage.addChild(this.loadingView);

		this.addDefaultManagers();
	}

	async initialize()
	{
		await this.managers.forEach(async manager => await manager.initialize());
	}

	async run()
	{
		this.loadingView.loadingBar.alpha = 0;
		setTimeout(() => this.loader.realLoad(() => this.onLoadingStage0Done(), 0), initialLoadingDelay);
	}

	onLoadingStage0Done()
	{
		this.loadingView.loadingBar.alpha = 1;
		this.loadingView.percentage = 0;
		this.loader.realLoad(() => this.onLoadingStage1Done(), 1);
	}

	onLoadingStage1Done()
	{
		Logger.debug("Application", "Loading of manager data done!");
		this.emit("application-loading-done");

		this.getManager(AvatarManager).initializeRenderer();

		delete this.loader;

		this.stage.removeChild(this.loadingView);

		let avatars = [undefined, undefined];
		let furnis = [undefined];
		let roomViewer = new RoomView();

		this.stage.addChild(roomViewer);
		this.stage.addChild(new InterfaceContainer());

		roomViewer.addChild(avatars[0] = new Avatar(randomFigure(), "vertical", "full"));
		roomViewer.addChild(avatars[1] = new Avatar(randomFigure(), "vertical", "full"));

		roomViewer.addChild(furnis[0] = new Furni("throne"));

		roomViewer.associateEntityToTile(avatars[0], 15, 0, 2);
		roomViewer.associateEntityToTile(avatars[1], 8, 20, 2);

		roomViewer.associateEntityToTile(furnis[0], 8, 21, 2);

		let controllingAvatar = 0;
		let current = {cr: 15, cc: 0, avatar: avatars[controllingAvatar]};

		// avatars[0].addAction("Blow");
		avatars[0].on("click", () => avatars[0].figure = randomFigure());
		avatars[0].on("click", () => roomViewer.centerEntity(avatars[0]));

		avatars[1].addAction("Wave");
		avatars[1].on("click", () => avatars[1].figure = randomFigure());
		avatars[1].on("click", () => roomViewer.centerEntity(avatars[1]));

		// roomViewer.centerEntity(avatars[controllingAvatar]);

		roomViewer.on("tile-click", evt => avatars[controllingAvatar].once("avatar-build", async () => current = await walkTo(roomViewer, current.avatar, current.cr, current.cc, evt.row, evt.column)));
	}

	getResource(resource, loader = undefined)
	{
		return (loader || this.loader).resources[resource];
	}

	getResources(loader = undefined)
	{
		return (loader || this.loader).resources;
	}

}
