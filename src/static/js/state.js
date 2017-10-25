let imagestate = 0;

function increment() {
    imagestate = imagestate + 1;
    console.log(imagestate);
    return imagestate;
}

function decrement() {
    if (imagestate <= 0) {
        imagestate = 0
    } else {
        imagestate = imagestate - 1;        
    }
    console.log(imagestate);
    return imagestate;
}

function currentState() {
    return imagestate;
}
