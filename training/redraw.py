"""
redraw.py

REstricted Differentiable Recurrent Attentional Writer
for image vectorization.

Zicheng Gao <zxg109@case.edu>

We consider some different ideas about the methods involved...
    
Encoding method: IMAGE -> LATENT
    E1: Zone separation [segmentation generation]
    E2: Separate attendance to each zone
        (Maybe use classifier loss.)

Decoding method: LATENT -> IMAGE
    D1: Edge-image pregeneration (cf. "lineart") (?)
        (cf Holistic Edge Detection? [2])
    D2: iter with increasing detail
    D3:   Flat color zone generation (cf. "flats")
    D4:   Greyscale toning (cf. "shading")

It's likelier that we only need one side, as
    both consuming and producing should draw the
    image in the forward (or backward) order.

==============================

Pseudointroduction:

Recent advances in image generation using Generative Adversarial
    Networks [5] have enabled the quick and straightforward production
    of mostly realistic images [4] or translation between any two
    coherent groups of images [7] [8]. However, the production of images
    using most Deconvolutional / Convolutional architectures produces
    distinctly nonhuman results and artifacts that are difficult
    to produce using most digital art platforms.

To this end, sequence models have been developed for the generation
    of vector text (chinese characters) [9] and recently, with Google's
    "Quick! Draw" dataset, crude sketches as well [1], allowing for
    a visual autocomplete in sketch space that offers ordered, followable
    guides.

The goal of REDRAW is to achieve arbitrary image generation with
    similarly human-readable instructions through restricting the
    generative process to become more in-line with human production methods.
    For example, usage of the line tool and paintbrush is much simpler
    than any deconvolution - especially so for a human artist to implement.
    This provides the additional benefit of massively simplifying
    our model, and presumably allowing for deeper compression of our image(s).

Methods exist for vector sequences of a uniform size [1]
    and for colorization of real images [10] and sketches [11].
    While work has been performed on converting sketches into vectorization-amenable
    "cleaned" formats as in [12] and [13], this is not readily applicable to
    the vectorization of full-color images, which we desire.

All-in-all, REDRAW should be capable of vectorizing arbitrary images
    into ordered sequences of strokes, which can massively supplement the
    landscape of vector image data which is much smaller than that of
    raster images.

As well, it is possible that using REDRAW to approximate photos or
    natural images can produce interesting results.

The writer in the DRAW model [3] is most promising for this task. One need only
    ensure that the writer is uniform and of predictable shape and size.

To ensure that the writer acts in a more human manner, we make the following changes:
    - Only allow quantized size jumps
    - Only allow color jumps
    - Allow only certain configurations of window output ("brush")
            Square? Circle? Either?
    - Add cost for switching of quantized variables (size, color)
    - Add cost for picking up the brush

    - Step cost (encourage speedy completion of drawing)

    - Restrict movement within a certain magnitude
    - End if movement is too small
            Separate stop signal?
            Cost threshold?

    Probably conv to 5[3x3] & GAP for movement.


Possible future investigation:
    Brush dynamics (Model brush based on physical system / photoshop brushes)
        (Keep it similar to freely available drawing platforms.)

"""

import os
import sys
import glob

import numpy as np
import tensorflow as tf

tf.flags.DEFINE_string("data_dir", "", "Data directory")
tf.flags.DEFINE_integer("steps", 5, "Number of steps to take in a single network iteration")
tf.flags.DEFINE_integer("input_size", 256, "MxM size to resize all inputs to")
tf.flags.DEFINE_integer("spatial_memory_size", 64, "Size of NxN intermediate spatial memory")
FLAGS = tf.flags.FLAGS

class Model(TrainableNetwork):

    def __init__(self):
        """
        Initialize network parameters and internal variables.
        """

        # Having an easily-serializable list makes transporting weights easier.
        self.weights = {}

        # Total number of parameters in "unwound" input size
        self.unwound_size = (FLAGS.input_size ** 2) * 3

    def __build_graph(self):
        """
        Initialize tensorflow graph
        """

        # Setup inputs. Images should be resized before entering graph. RGB input images.
        inputs = tf.placeholder(tf.float32, shape=[FLAGS.batchsize, input_size, input_size, 3], name='inputs')

        # Initialize state, attentional window, spatial memory, and brush holders
        history_state = [inputs]
        history_window = [self.initialize_window()]
        history_memory = []
        history_brush = []

        # Initial step
        for i in range(FLAGS.steps):
            # Read using current window the current memory
            new_memory = self.read(history_state[-1], history_window[-1])
            history_memory.append(new_memory)

            # Calculate brush with memory
            new_brush = self.brush(history_memory[-1])
            history_brush.append(new_brush)

            # Apply brush to state to get next state
            new_state = self.write(history_state[-1], history_brush[-1])
            history_state.append(new_state)

            # Calculate new window from new state
            new_window = self.window(history_state[-1])
            history_window.append(new_window)

        # Determine loss - use special loss to prevent deletion by averaging.
        # Account for brush parameters also in the loss function.
        loss = self.cumulative_loss(history_state, history_brush)

        # Prepare brush parameters for output
        output_brush = tf.stack(history_brush, axis=0, name='output_brush')

    def read(self, state, window):
        """
        Sample a memory tensor from the state using the prescribed window
        """
        raise NotImplementedError()

        return new_memory

    def brush(self, memory):
        raise NotImplementedError()

    def write(self, old_state, brush):
        raise NotImplementedError()

    def window(self, state):
        raise NotImplementedError()


"""
References:
[1] https://arxiv.org/abs/1704.03477
    sketch-rnn
    Vector image sketch AE with seq2seq & hypnet.

[2] https://arxiv.org/abs/1504.06375
    holistically nested edge detection

[3] https://arxiv.org/abs/1502.04623
    DRAW

[4] https://arxiv.org/abs/1609.03552
    interactive REALISTIC NATURAL image generation
    with GAN

[5] https://arxiv.org/abs/1406.2661
    GAN

[6] https://arxiv.org/abs/1603.01768
    neural doodle (semantic style transfer)
    It's class conditional DCGAN in-image.

[7] https://arxiv.org/abs/1611.07004
    pix2pix

[8] https://arxiv.org/abs/1703.10593
    cycleGAN

[9] http://blog.otoro.net/2015/12/28/recurrent-net-dreams-up-fake-chinese-characters-in-vector-format-with-tensorflow/

[10] https://richzhang.github.io/ideepcolor/
[11] https://paintschainer.preferred.tech/index_en.html

"""