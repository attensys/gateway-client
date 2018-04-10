const WebSocket = require("ws");

module.exports = class AttensysGatewayClient {
  constructor({ host }) {
    this.socketAddress = `ws://${host}/events`;
    this.socket = new WebSocket(this.socketAddress);

    this.isOpen = false;

    this.socket
      .on("open", this.onOpen.bind(this))
      .on("message", this.onMessage.bind(this))
      .on("close", this.onClose.bind(this))
      .on("error", this.onError.bind(this));

    this.listeners = [];
    this.localListerners = [];
  }

  onOpen(event) {
    console.log(`connected to ${this.socketAddress}`);
    this.isOpen = true;
    this.listeners.filter(listener => listener.connect).forEach(listener =>
      listener.connect({
        server: this.socketAddress
      })
    );
  }

  onError(event) {
    console.error(event);
  }

  onClose() {
    console.log(`disconnected from ${this.socketAddress}`);
    this.isOpen = false;
  }

  /**
   * Adds listener
   *
   * @param {object} listener
   * @returns {object}
   * @memberof Attensys
   */
  addListener(listener) {
    this.listeners.push(listener);
    return listener;
  }

  /**
   * Removes listener
   *
   * @param {object} listener
   * @memberof Attensys
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    this.listeners.splice(index, 1);
  }

  ensureOpeness() {
    return new Promise((resolve, reject) => {
      if (this.isOpen) {
        resolve();
      } else {
        const interval = setInterval(() => {
          if (this.isOpen) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      }
    });
  }

  /**
   * subscribe
   *
   * @param {any} [{ topic = "", limit = undefined, query = undefined }={}]
   * @memberof Attensys
   */
  subscribe({ topic = "", limit = undefined, query = undefined } = {}) {
    topic = query ? `${topic}?${query}` : topic;
    this.ensureOpeness().then(() => {
      const message = JSON.stringify({
        type: "subscribe",
        topic,
        limit
      });

      this.socket.send(message);
    });
    return this._registerLocalListener(topic);
  }

  _registerLocalListener(topic) {
    return {
      on: handlers => this.localListerners.push({ topic, handlers })
    };
  }

  onMessage(event) {
    const data = JSON.parse(event);
    const { type } = data;

    const handlers = {
      "subscribe-ack": this.subscriptionHandler.bind(this),
      "unsubscribe-ack": this.unsubscriptionHandler.bind(this),
      event: this.messageHandler.bind(this),
      error: this.errorHandler.bind(this)
    };

    handlers[type](data);
  }

  subscriptionHandler(data) {
    this.listeners
      .filter(listener => listener.subscribe)
      .forEach(listener => listener.subscribe(data));

    this.localListerners.forEach(listener => {
      if (listener.topic === data.topic) {
        listener.subscriptionId = data.subscriptionId;
      }
    });
  }

  unsubscriptionHandler(data) {
    this.listeners
      .filter(listener => listener.unsubscribe)
      .forEach(listener => listener.unsubscribe(data));
  }

  errorHandler(data) {
    this.listeners
      .filter(listener => listener.error)
      .forEach(listener => listener.error(data));
  }

  messageHandler(data) {
    this.listeners
      .filter(listener => listener.message)
      .forEach(listener => listener.message(data.data));

    this.localListerners
      .filter(listener => listener.subscriptionId === data.subscriptionId)
      .filter(listener => listener.handlers.message)
      .forEach(listener => listener.handlers.message(data.data));
  }
};
